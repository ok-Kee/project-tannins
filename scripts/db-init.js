require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || './db/tannins.db';
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
`);

db.close();
console.log(`Database initialized at ${dbPath}`);
