require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const defaultDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tannins.db')
  : './db/tannins.db';

const db = new Database(process.env.DB_PATH || defaultDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
