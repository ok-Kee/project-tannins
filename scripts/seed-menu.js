require('dotenv').config();
const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

// Menu importer. Reads a [Category, Item, Description, Size, Price] CSV and inserts
// menu_items scoped to one tenant. Insert-only + idempotent (skips an item already present
// for this restaurant by name), so it is safe to re-run and safe to apply to prod additively.
//
// Env:
//   DB_PATH        db location (honored; on Render pass /data/tannins.db)
//   MENU_CSV_PATH  override the CSV (default: repo data/mountain-prime/mps-menu.csv)
//   MENU_SLUG      target tenant slug (default: mountain-prime)

const defaultDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tannins.db')
  : './db/tannins.db';
const dbPath = process.env.DB_PATH || defaultDbPath;
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const CSV_PATH = process.env.MENU_CSV_PATH
  || path.join(__dirname, '../data/mountain-prime/mps-menu.csv');
const RESTAURANT_SLUG = process.env.MENU_SLUG || 'mountain-prime';

// Minimal CSV parser: handles double-quoted fields containing commas. One record per line.
function parseCsv(text) {
  const records = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === '') continue;
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      if (inQuotes) {
        if (ch === '"' && rawLine[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { cur += ch; }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    records.push(fields.map(f => f.trim()));
  }
  return records;
}

function main() {
  const restaurant = db.prepare('SELECT id, name FROM restaurants WHERE slug = ?').get(RESTAURANT_SLUG);
  if (!restaurant) {
    throw new Error(`Tenant "${RESTAURANT_SLUG}" not found. Create it (or run the wine import) first.`);
  }
  const restaurantId = restaurant.id;
  console.log(`Restaurant: ${restaurant.name} (id=${restaurantId})`);

  const records = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const header = records.shift(); // Category,Item,Description,Size,Price
  if (!header || header[0].toLowerCase() !== 'category' || header[1].toLowerCase() !== 'item') {
    throw new Error(`Unexpected CSV header: ${JSON.stringify(header)} (expected Category,Item,Description,Size,Price)`);
  }

  const findItem = db.prepare(
    'SELECT id FROM menu_items WHERE restaurant_id = ? AND name = ?'
  );
  const insertItem = db.prepare(`
    INSERT INTO menu_items (restaurant_id, name, description, category, price, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;
  let sortOrder = 0;

  const importAll = db.transaction(() => {
    for (const [category, item, description, size, price] of records) {
      if (!item) continue;

      // Fold Size (e.g. "22 oz") into the item name so it shows on the dish card.
      const sizeStr = size != null ? String(size).trim() : '';
      const name = sizeStr ? `${String(item).trim()} (${sizeStr})` : String(item).trim();

      // Price: numeric only. "MP", "Choice of One", etc. -> NULL.
      const priceStr = price != null ? String(price).trim() : '';
      const priceNum = priceStr !== '' && !isNaN(Number(priceStr)) ? Number(priceStr) : null;

      const desc = description != null && String(description).trim() !== '' ? String(description).trim() : null;
      const cat = category != null && String(category).trim() !== '' ? String(category).trim() : null;

      sortOrder += 1;

      if (findItem.get(restaurantId, name)) {
        skipped++;
        continue;
      }

      insertItem.run(restaurantId, name, desc, cat, priceNum, sortOrder);
      imported++;
    }
  });

  importAll();
  console.log(`Menu import complete: ${imported} items imported, ${skipped} skipped (already present)`);
  db.close();
}

main();
