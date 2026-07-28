require('dotenv').config();
const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

// Non-wine beverage importer. Reads a deterministic [name, type, price] CSV (structured
// once, by hand, from a client's beverage document) and loads it as beverages (+ wine_list
// rows) for one tenant. No AI / pairing / enrich for these. Insert-only + idempotent.
//
// A blank price -> NULL. Price lands in "Per Bottle" for bottled/canned/ml items and
// "By the Glass" for everything else (drafts, ports, cocktails, mocktails), matching how
// the server view labels a single price.
//
// Env:
//   DB_PATH        db location (honored; on Render pass /data/tannins.db)
//   BEV_CSV_PATH   override the CSV (default: repo data/mountain-prime/mps-nonwine-beverages.csv)
//   BEV_SLUG       target tenant slug (default: mountain-prime)

const defaultDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tannins.db')
  : './db/tannins.db';
const dbPath = process.env.DB_PATH || defaultDbPath;
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const CSV_PATH = process.env.BEV_CSV_PATH
  || path.join(__dirname, '../data/mountain-prime/mps-nonwine-beverages.csv');
const RESTAURANT_SLUG = process.env.BEV_SLUG || 'mountain-prime';

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
  const header = records.shift(); // name,type,price
  if (!header || header[0].toLowerCase() !== 'name') {
    throw new Error(`Unexpected CSV header: ${JSON.stringify(header)} (expected name,type,price)`);
  }

  const findBeverage = db.prepare('SELECT id FROM beverages WHERE name = ?');
  const insertBeverage = db.prepare(
    'INSERT INTO beverages (name, type, general_pairing) VALUES (?, ?, NULL)'
  );
  const findWineList = db.prepare(
    'SELECT id FROM wine_list WHERE restaurant_id = ? AND beverage_id = ?'
  );
  const insertWineList = db.prepare(`
    INSERT INTO wine_list (restaurant_id, beverage_id, price_btg, price_btl)
    VALUES (?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  const importAll = db.transaction(() => {
    for (const [name, type, priceRaw] of records) {
      if (!name) continue;
      const priceNum = priceRaw != null && priceRaw !== '' && !isNaN(Number(priceRaw))
        ? Number(priceRaw)
        : null;

      // Bottled/canned/ml items read best as "Per Bottle"; everything else "By the Glass".
      const perBottle = /bottle|can\b|\d+\s?ml/i.test(name);
      const priceBtg = !perBottle ? priceNum : null;
      const priceBtl = perBottle ? priceNum : null;

      let bev = findBeverage.get(name);
      if (!bev) {
        const res = insertBeverage.run(name, type || 'Other');
        bev = { id: res.lastInsertRowid };
      }

      if (findWineList.get(restaurantId, bev.id)) {
        skipped++;
        continue;
      }

      insertWineList.run(restaurantId, bev.id, priceBtg, priceBtl);
      imported++;
    }
  });

  importAll();
  console.log(`Non-wine beverage import complete: ${imported} imported, ${skipped} skipped (already on list)`);
  db.close();
}

main();
