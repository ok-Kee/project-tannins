require('dotenv').config();
const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = process.env.DB_PATH || './db/tannins.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const EXCEL_PATH = path.join(__dirname, '../Tannins Bar Wine 2026.xlsx');
const RESTAURANT_SLUG = 'tannins-bar';
const RESTAURANT_NAME = 'Tannins Bar';
const RESTAURANT_USER = 'admin';
const RESTAURANT_PASS = process.env.TANNINS_BAR_PASS || 'changeme';

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

function isHeaderRow(row) {
  const first = String(row[0] || '');
  return (
    first.includes('Tannins Bar') ||
    first === '' ||
    getSectionType(first) !== null
  );
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
  const ws = wb.Sheets['MPS WINE LIST'];
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
      const [col0, col1, col2, col3] = row;

      // Skip blank rows
      if (!col0) continue;

      // Skip title row
      if (String(col0).includes('Tannins Bar')) continue;

      // Check if it's a section header
      const section = getSectionType(col0);
      if (section) {
        currentType = section.type;
        currentBtg = section.btg;
        continue;
      }

      // It's a wine row — col0=name, col1=region, col2=btg price, col3=btl price
      const name = String(col0).trim();
      if (!name) continue;

      const priceBtg = currentBtg && col2 != null ? Number(col2) : (col2 != null && !currentBtg ? null : col2 != null ? Number(col2) : null);
      const priceBtl = col3 != null ? Number(col3) : null;
      // Simpler: btg price is col2 only if we're in a BTG section
      const finalPriceBtg = currentBtg && col2 != null ? Number(col2) : null;
      const finalPriceBtl = col3 != null ? Number(col3) : (!currentBtg && col2 != null ? Number(col2) : null);

      // Find or create beverage
      let bev = findBeverage.get(name);
      if (!bev) {
        const res = insertBeverage.run(name, currentType);
        bev = { id: res.lastInsertRowid };
      }

      // Insert wine_list record if not already present
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
  console.log(`Import complete: ${imported} wines imported, ${skipped} skipped (already existed)`);
  db.close();
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
