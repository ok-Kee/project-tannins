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

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a professional sommelier. Given a wine or beverage name and its type, write a concise flavor profile describing what it tastes like — primary fruit and aroma notes, body, acidity, tannin (for reds), sweetness, and finish where relevant. Keep it to 2-3 sentences a restaurant server can read at a glance and relay to a guest. Do not include food pairings or introductory phrases — describe only the taste, starting directly with the flavor notes.`;

async function flavorFor(bev) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Beverage: ${bev.name}\nType: ${bev.type}\n\nDescribe its flavor profile.`,
      },
    ],
  });
  return message.content[0].text.trim();
}

async function main() {
  const unflavored = db.prepare(
    "SELECT id, name, type FROM beverages WHERE flavor_profile IS NULL OR flavor_profile = ''"
  ).all();

  console.log(`Found ${unflavored.length} beverages to add flavor profiles for`);

  const updateFlavor = db.prepare('UPDATE beverages SET flavor_profile = ? WHERE id = ?');

  for (let i = 0; i < unflavored.length; i++) {
    const bev = unflavored[i];
    try {
      console.log(`[${i + 1}/${unflavored.length}] Flavoring: ${bev.name}`);
      const flavor = await flavorFor(bev);
      updateFlavor.run(flavor, bev.id);
      // Rate limit: 100ms between calls
      if (i < unflavored.length - 1) await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`  ERROR flavoring "${bev.name}":`, err.message);
    }
  }

  console.log('Flavor profiling complete');
  db.close();
}

main().catch(err => {
  console.error('Flavor script failed:', err);
  process.exit(1);
});
