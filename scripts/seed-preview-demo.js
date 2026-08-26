require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Seeds a throwaway "demo" tenant so Render PREVIEW environments have something to
// show. A preview's persistent disk starts empty (Render copies no data into
// previews), so without this a preview boots with schema only and zero tenants —
// nothing to visit. See docs/runbook.md ("Preview environments").
//
// SAFETY: this must NEVER run against production. Render sets IS_PULL_REQUEST=true
// only inside preview environments; we hard-gate on it. render.yaml wires this into
// the service `initialDeployHook` (which runs once, on a service's first deploy),
// and prod already exists so its hook never re-fires — but the env guard is the real
// backstop. The script is also idempotent (no-op if the demo tenant already exists).

if (process.env.IS_PULL_REQUEST !== 'true') {
  console.log(
    'seed-preview-demo: IS_PULL_REQUEST is not "true" — not a preview environment, skipping (no changes made).'
  );
  process.exit(0);
}

// Resolve the DB path the SAME way the app does (src/db.js / create-tenant.js):
// honor DB_PATH, then DATA_DIR (the Render persistent disk), then local ./db.
const defaultDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tannins.db')
  : './db/tannins.db';
const dbPath = process.env.DB_PATH || defaultDbPath;

const SLUG = 'demo';
const NAME = 'Demo Bistro';
const HTTP_USER = 'admin';
const password = process.env.DEMO_TENANT_PASS || 'preview';

// A small, self-contained demo dataset (no AI enrichment needed — general_pairing
// and flavor_profile are pre-filled so the guest pages render fully).
const BEVERAGES = [
  {
    name: 'Estate Cabernet Sauvignon',
    type: 'Red',
    general_pairing: 'Grilled red meats, aged cheeses, and rich tomato dishes.',
    flavor_profile: 'Full-bodied with blackcurrant, cedar, and a firm tannic finish.',
    price_btl: 62,
    price_btg: 15,
    sommelier_comments: 'Our flagship red — decant for 30 minutes.',
  },
  {
    name: 'Coastal Chardonnay',
    type: 'White',
    general_pairing: 'Roast chicken, creamy pastas, and buttery seafood.',
    flavor_profile: 'Medium-bodied with ripe pear, citrus, and a touch of oak.',
    price_btl: 48,
    price_btg: 12,
    sommelier_comments: 'Lightly oaked; serve well chilled.',
  },
  {
    name: 'Hillside Pinot Noir',
    type: 'Red',
    general_pairing: 'Salmon, mushroom dishes, and roast pork.',
    flavor_profile: 'Light-bodied with red cherry, earth, and soft tannins.',
    price_btl: 55,
    price_btg: 14,
    sommelier_comments: 'A versatile, food-friendly red.',
  },
];

// Menu items, each pointing at beverages (by index above) it pairs with.
const MENU = [
  {
    name: 'Dry-Aged Ribeye',
    description: '12oz dry-aged ribeye, roasted garlic butter, seasonal vegetables.',
    category: 'Mains',
    price: 46,
    pairings: [
      { beverage: 0, text: 'The Cabernet’s firm tannins cut the ribeye’s richness beautifully.' },
    ],
  },
  {
    name: 'Pan-Seared Salmon',
    description: 'Wild salmon, lemon beurre blanc, wilted greens.',
    category: 'Mains',
    price: 34,
    pairings: [
      { beverage: 2, text: 'Pinot Noir’s bright cherry complements salmon without overpowering it.' },
      { beverage: 1, text: 'Prefer white? The Chardonnay’s citrus lifts the beurre blanc.' },
    ],
  },
];

async function main() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const existing = db.prepare('SELECT id, name FROM restaurants WHERE slug = ?').get(SLUG);
  if (existing) {
    console.log(
      `seed-preview-demo: demo tenant already present (${existing.name}, slug=${SLUG}, id=${existing.id}) — no changes made.`
    );
    db.close();
    return;
  }

  const hash = await bcrypt.hash(password, 10);

  const seed = db.transaction(() => {
    const restId = db
      .prepare(
        `INSERT INTO restaurants (slug, name, http_user, http_pass_hash, theme_accent, theme_bg)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(SLUG, NAME, HTTP_USER, hash, '#C9A84C', '#0A0A0A').lastInsertRowid;

    // beverages is the shared global catalog; wine_list is the per-tenant stock row.
    const wineListIds = BEVERAGES.map((b) => {
      const bevId = db
        .prepare(
          `INSERT INTO beverages (name, type, general_pairing, flavor_profile)
           VALUES (?, ?, ?, ?)`
        )
        .run(b.name, b.type, b.general_pairing, b.flavor_profile).lastInsertRowid;

      return db
        .prepare(
          `INSERT INTO wine_list (restaurant_id, beverage_id, sommelier_comments, price_btl, price_btg)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(restId, bevId, b.sommelier_comments, b.price_btl, b.price_btg).lastInsertRowid;
    });

    MENU.forEach((m, i) => {
      const menuId = db
        .prepare(
          `INSERT INTO menu_items (restaurant_id, name, description, category, price, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(restId, m.name, m.description, m.category, m.price, i).lastInsertRowid;

      m.pairings.forEach((p, j) => {
        db.prepare(
          `INSERT INTO menu_item_pairings (menu_item_id, wine_list_id, ai_pairing_text, sort_order)
           VALUES (?, ?, ?, ?)`
        ).run(menuId, wineListIds[p.beverage], p.text, j);
      });
    });

    return restId;
  });

  const restId = seed();

  console.log(`seed-preview-demo: created demo tenant for this preview.`);
  console.log(`  db:         ${dbPath}`);
  console.log(`  id:         ${restId}`);
  console.log(`  guest:      /${SLUG}`);
  console.log(`  cuisine:    /${SLUG}/cuisine`);
  console.log(`  server:     /${SLUG}/server`);
  console.log(`  admin:      /${SLUG}/de   (user "${HTTP_USER}", password "${password}")`);
  db.close();
}

main().catch((err) => {
  console.error('seed-preview-demo failed:', err);
  process.exit(1);
});
