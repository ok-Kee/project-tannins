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
    general_pairing TEXT,
    flavor_profile TEXT
  );

  CREATE TABLE IF NOT EXISTS wine_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    rack_id INTEGER REFERENCES racks(id),
    beverage_id INTEGER NOT NULL REFERENCES beverages(id),
    sommelier_comments TEXT,
    house_pairing TEXT,
    house_flavor_profile TEXT,
    house_name TEXT,
    house_type TEXT,
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
    ai_pairing_text TEXT,
    house_pairing_text TEXT,
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

// Add price column to menu_items for existing databases
try {
  db.exec('ALTER TABLE menu_items ADD COLUMN price DECIMAL');
} catch (e) {
  if (!e.message.includes('duplicate column name')) throw e;
}

// Add flavor_profile column to beverages for existing databases
try {
  db.exec('ALTER TABLE beverages ADD COLUMN flavor_profile TEXT');
} catch (e) {
  if (!e.message.includes('duplicate column name')) throw e;
}

// Add house_flavor_profile column to wine_list for existing databases
// (per-restaurant override of the shared beverages.flavor_profile)
try {
  db.exec('ALTER TABLE wine_list ADD COLUMN house_flavor_profile TEXT');
} catch (e) {
  if (!e.message.includes('duplicate column name')) throw e;
}

// Add house_name / house_type columns to wine_list for existing databases
// (per-restaurant override of the shared beverages.name / beverages.type)
for (const col of ['house_name TEXT', 'house_type TEXT']) {
  try {
    db.exec(`ALTER TABLE wine_list ADD COLUMN ${col}`);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }
}

// Add per-pairing text columns to menu_item_pairings for existing databases.
// ai_pairing_text = LLM-generated "why this beverage pairs with this dish";
// house_pairing_text = the restaurant's per-entry override. Display = house || ai.
for (const col of ['ai_pairing_text TEXT', 'house_pairing_text TEXT']) {
  try {
    db.exec(`ALTER TABLE menu_item_pairings ADD COLUMN ${col}`);
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
