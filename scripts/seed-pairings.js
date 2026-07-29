require('dotenv').config();
const Database = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

// Resolve the DB path the SAME way the app does (src/db.js): honor DB_PATH,
// then DATA_DIR (the Render persistent disk), then fall back to local ./db.
const defaultDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tannins.db')
  : './db/tannins.db';
const db = new Database(process.env.DB_PATH || defaultDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const client = new Anthropic();

// Which tenant to generate pairings for. Scoped so a prod run only touches this
// restaurant and never the shared `tannins-bar` demo.
const RESTAURANT_SLUG = process.env.RESTAURANT_SLUG || 'mountain-prime';

// Beverage-centric generation: for each eligible beverage, the model picks its best
// 2-4 dishes from this restaurant's menu and writes a per-pairing note in one pass.
// Eligible = all alcoholic + mocktails; skip sodas/juices/N-A drinks (type 'N/A').
const EXCLUDED_TYPES = ['N/A'];

const SYSTEM_PROMPT = `You are a professional sommelier and beverage director building a wine/beverage pairing guide for a restaurant. You are given one beverage and the restaurant's full food menu. Choose the 2-4 menu items this beverage pairs with best, and for each write a concise pairing note (1-2 sentences) a server can read at a glance and relay to a guest — say why it works (complementary or contrasting flavors, weight, acidity, tannin). Start each note directly with the reasoning; no preamble.

Only pick genuinely good matches. If fewer than 4 dishes truly suit the beverage, return fewer — never pad. Respond with ONLY a JSON array, no prose, no code fences, in this exact shape:
[{"menu_item_id": <number>, "note": "<pairing note>"}]
Use only menu_item_id values from the provided menu.`;

function buildMenuBlock(menuItems) {
  return menuItems
    .map((m) => {
      const cat = m.category ? ` [${m.category}]` : '';
      const desc = m.description ? ` — ${m.description}` : '';
      return `${m.id}: ${m.name}${cat}${desc}`;
    })
    .join('\n');
}

function parsePairings(text, validIds) {
  // Strip code fences if the model added them despite instructions.
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let arr;
  try {
    arr = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`could not parse JSON response: ${text.slice(0, 200)}`);
  }
  if (!Array.isArray(arr)) throw new Error('response was not a JSON array');
  return arr
    .filter((p) => p && validIds.has(Number(p.menu_item_id)) && typeof p.note === 'string' && p.note.trim())
    .map((p) => ({ menu_item_id: Number(p.menu_item_id), note: p.note.trim() }));
}

async function pairingsFor(bev, menuBlock, validIds) {
  const flavor = bev.flavor_profile ? `\nFlavor profile: ${bev.flavor_profile}` : '';
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Beverage: ${bev.name}\nType: ${bev.type}${flavor}\n\nMenu:\n${menuBlock}\n\nReturn the best 2-4 pairings as JSON.`,
      },
    ],
  });
  return parsePairings(message.content[0].text, validIds);
}

async function main() {
  const restaurant = db
    .prepare('SELECT id, name FROM restaurants WHERE slug = ?')
    .get(RESTAURANT_SLUG);
  if (!restaurant) {
    console.error(`No restaurant with slug "${RESTAURANT_SLUG}"`);
    process.exit(1);
  }
  console.log(`Generating pairings for ${restaurant.name} (id ${restaurant.id})`);

  const menuItems = db
    .prepare('SELECT id, name, description, category FROM menu_items WHERE restaurant_id = ? ORDER BY sort_order, name')
    .all(restaurant.id);
  if (!menuItems.length) {
    console.error('No menu items for this restaurant — nothing to pair against.');
    process.exit(1);
  }
  const validIds = new Set(menuItems.map((m) => m.id));
  const menuBlock = buildMenuBlock(menuItems);

  // Eligible beverages on this restaurant's list, minus excluded types, minus any
  // wine_list entry that already has pairings (idempotent / fill-only — safe re-runs).
  const placeholders = EXCLUDED_TYPES.map(() => '?').join(', ');
  const beverages = db
    .prepare(
      `SELECT wl.id AS wine_list_id,
              COALESCE(wl.house_name, b.name) AS name,
              COALESCE(wl.house_type, b.type) AS type,
              b.flavor_profile
       FROM wine_list wl
       JOIN beverages b ON b.id = wl.beverage_id
       WHERE wl.restaurant_id = ?
         AND COALESCE(wl.house_type, b.type) NOT IN (${placeholders})
         AND NOT EXISTS (SELECT 1 FROM menu_item_pairings mip WHERE mip.wine_list_id = wl.id)
       ORDER BY name`
    )
    .all(restaurant.id, ...EXCLUDED_TYPES);

  console.log(`Found ${beverages.length} beverages needing pairings (of the eligible set)`);

  const insert = db.prepare(
    'INSERT OR IGNORE INTO menu_item_pairings (menu_item_id, wine_list_id, ai_pairing_text, sort_order) VALUES (?, ?, ?, ?)'
  );

  let totalPairings = 0;
  for (let i = 0; i < beverages.length; i++) {
    const bev = beverages[i];
    try {
      console.log(`[${i + 1}/${beverages.length}] Pairing: ${bev.name} (${bev.type})`);
      const pairings = await pairingsFor(bev, menuBlock, validIds);
      pairings.forEach((p, idx) => {
        insert.run(p.menu_item_id, bev.wine_list_id, p.note, idx);
      });
      totalPairings += pairings.length;
      console.log(`    ${pairings.length} pairings`);
      if (i < beverages.length - 1) await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error(`  ERROR pairing "${bev.name}":`, err.message);
    }
  }

  console.log(`Pairing generation complete — ${totalPairings} pairings inserted`);
  db.close();
}

main().catch((err) => {
  console.error('Pairing script failed:', err);
  process.exit(1);
});
