require('dotenv').config();
const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Mountain Prime Steakhouse wine importer. A thin variant of seed-import.js:
// same section-header/price parser (MP's spreadsheet shares Tannins' exact layout),
// but pointed at MP's file/sheet/tenant. Insert-only + idempotent (skips a wine already
// on this restaurant's list), so it is safe to re-run and safe against prod additively.
//
// Env:
//   DB_PATH            db location (older scripts honor DB_PATH ONLY; on Render pass /data/tannins.db)
//   MPS_EXCEL_PATH     override the wine .xlsx (default: repo data/mountain-prime/mps-wine.xlsx)
//   MPS_SHEET_NAME     override the sheet name (default: the trailing-space MP sheet)
//   MOUNTAIN_PRIME_PASS / TENANT_PASS   admin password if the tenant must be created

const dbPath = process.env.DB_PATH || './db/tannins.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const EXCEL_PATH = process.env.MPS_EXCEL_PATH
  || path.join(__dirname, '../data/mountain-prime/mps-wine.xlsx');
// NB: the actual sheet name has a trailing space.
const SHEET_NAME = process.env.MPS_SHEET_NAME || 'Mountian Prime Steakhouse Wine ';
const RESTAURANT_SLUG = 'mountain-prime';
const RESTAURANT_NAME = 'Mountain Prime Steakhouse';
const RESTAURANT_USER = 'admin';
const RESTAURANT_PASS = process.env.MOUNTAIN_PRIME_PASS || process.env.TENANT_PASS || 'changeme';
const TITLE_ROW = 'Mountain Prime Steakhouse Kalispell Wine List 2026';

// Map section header keywords to wine types
const SECTION_TYPE_MAP = [
  { match: /btg bubbles|btg.*bubble/i, type: 'Sparkling Wine', btg: true },
  { match: /btg.*pink|btg.*rose/i, type: 'Rosé', btg: true },
  { match: /btg white/i, type: 'White', btg: true },
  { match: /btg red/i, type: 'Red', btg: true },
  { match: /list pink|list.*rose|list.*orange/i, type: 'Rosé', btg: false },
  { match: /list bubbles/i, type: 'Sparkling Wine', btg: false },
  { match: /list whites/i, type: 'White', btg: false },
  { match: /list reds/i, type: 'Red', btg: false },
  { match: /desserts/i, type: 'Dessert', btg: false },
];

function getSectionType(cellValue) {
  const str = String(cellValue || '');
  for (const entry of SECTION_TYPE_MAP) {
    if (entry.match.test(str)) return entry;
  }
  return null;
}

async function main() {
  // Ensure restaurant record exists
  let restaurant = db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(RESTAURANT_SLUG);
  if (!restaurant) {
    const hash = await bcrypt.hash(RESTAURANT_PASS, 10);
    const result = db.prepare(
      'INSERT INTO restaurants (slug, name, http_user, http_pass_hash) VALUES (?, ?, ?, ?)'
    ).run(RESTAURANT_SLUG, RESTAURANT_NAME, RESTAURANT_USER, hash);
    restaurant = { id: result.lastInsertRowid };
    console.log(`Created restaurant: ${RESTAURANT_NAME} (id=${restaurant.id})`);
  } else {
    console.log(`Restaurant exists: ${RESTAURANT_NAME} (id=${restaurant.id})`);
  }

  const restaurantId = restaurant.id;

  // Read Excel
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(`Sheet "${SHEET_NAME}" not found. Sheets: ${JSON.stringify(wb.SheetNames)}`);
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let currentType = 'White';
  let currentBtg = false;
  let imported = 0;
  let skipped = 0;

  const insertBeverage = db.prepare(
    'INSERT INTO beverages (name, type, general_pairing) VALUES (?, ?, NULL)'
  );
  const findBeverage = db.prepare('SELECT id FROM beverages WHERE name = ?');
  const insertWineList = db.prepare(`
    INSERT INTO wine_list (restaurant_id, beverage_id, price_btg, price_btl)
    VALUES (?, ?, ?, ?)
  `);
  const findWineList = db.prepare(
    'SELECT id FROM wine_list WHERE restaurant_id = ? AND beverage_id = ?'
  );

  const importAll = db.transaction(() => {
    for (const row of rows) {
      const [col0, , col2, col3] = row; // col0=name, col1=region (unused), col2=btg, col3=btl

      // Skip blank rows
      if (!col0) continue;

      // Skip title row
      if (String(col0).includes(TITLE_ROW)) continue;

      // Check if it's a section header
      const section = getSectionType(col0);
      if (section) {
        currentType = section.type;
        currentBtg = section.btg;
        continue;
      }

      // It's a wine row. In a BTG section col2=by-the-glass price, col3=bottle;
      // in a List/Desserts section there's no glass pour, so col3 (or col2) is the bottle.
      const name = String(col0).trim();
      if (!name) continue;

      // MP's "BTG Bubbles & Pink" section mixes true sparkling with rosés. Re-type a
      // wine as Rosé by name so servers see it grouped correctly (only the Prosecco etc.
      // stays Sparkling). Elsewhere the section header type stands.
      // \b so "rosé" as a word matches but "pROSEcco" does not.
      const rowType = currentType === 'Sparkling Wine' && /\bros[eé]\b|gris de gris/i.test(name)
        ? 'Rosé'
        : currentType;

      const finalPriceBtg = currentBtg && col2 != null ? Number(col2) : null;
      const finalPriceBtl = col3 != null ? Number(col3) : (!currentBtg && col2 != null ? Number(col2) : null);

      // Find or create beverage (shared global catalog, keyed by name)
      let bev = findBeverage.get(name);
      if (!bev) {
        const res = insertBeverage.run(name, rowType);
        bev = { id: res.lastInsertRowid };
      }

      // Insert wine_list record if not already present for this restaurant
      const existing = findWineList.get(restaurantId, bev.id);
      if (existing) {
        skipped++;
        continue;
      }

      insertWineList.run(restaurantId, bev.id, finalPriceBtg, finalPriceBtl);
      imported++;
    }
  });

  importAll();
  console.log(`Wine import complete: ${imported} wines imported, ${skipped} skipped (already on list)`);
  db.close();
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
