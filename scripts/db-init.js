require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const defaultDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tannins.db')
  : './db/tannins.db';
const dbPath = process.env.DB_PATH || defaultDbPath;
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    http_user TEXT NOT NULL,
    http_pass_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS racks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    rack_number TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS beverages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    general_pairing TEXT
  );

  CREATE TABLE IF NOT EXISTS wine_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    rack_id INTEGER REFERENCES racks(id),
    beverage_id INTEGER NOT NULL REFERENCES beverages(id),
    sommelier_comments TEXT,
    house_pairing TEXT,
    snack_notes TEXT,
    price_btl DECIMAL,
    price_btg DECIMAL,
    label_image_path TEXT,
    bottle_image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS menu_item_pairings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    wine_list_id INTEGER NOT NULL REFERENCES wine_list(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(menu_item_id, wine_list_id)
  );
`);

// Add columns to restaurants for existing databases
for (const col of [
  'logo_image_path TEXT',
  'theme_accent TEXT',
  'theme_bg TEXT',
]) {
  try {
    db.exec(`ALTER TABLE restaurants ADD COLUMN ${col}`);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }
}

// Rename tannins-bar slug to tannins-bar if still present
db.prepare(`
  UPDATE restaurants SET slug = 'tannins-bar', name = 'Tannins Bar'
  WHERE slug = 'tannins-bar'
`).run();

// Seed default theme colors
db.prepare(`
  UPDATE restaurants SET theme_accent = '#C9A84C', theme_bg = '#0A0A0A'
  WHERE slug = 'tannins-bar' AND (theme_accent IS NULL OR theme_bg IS NULL)
`).run();

db.close();
console.log(`Database initialized at ${dbPath}`);
