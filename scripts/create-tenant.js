require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Resolve the DB path the SAME way the app does (src/db.js): honor DB_PATH,
// then DATA_DIR (the Render persistent disk), and only fall back to local ./db.
const defaultDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tannins.db')
  : './db/tannins.db';
const dbPath = process.env.DB_PATH || defaultDbPath;

// Usage: node scripts/create-tenant.js <slug> "<name>" [http_user]
//   password is read from TENANT_PASS (env) so it never lands in argv/shell history
const [, , slug, name, httpUser = 'admin'] = process.argv;
const password = process.env.TENANT_PASS;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!slug || !name) {
  fail('usage: node scripts/create-tenant.js <slug> "<name>" [http_user]  (TENANT_PASS env required)');
}
if (!password) {
  fail('TENANT_PASS environment variable is required (the tenant admin password)');
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  fail(`slug "${slug}" must be lowercase letters, numbers, and hyphens only (it becomes the URL path)`);
}

async function main() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const existing = db.prepare('SELECT id, name FROM restaurants WHERE slug = ?').get(slug);
  if (existing) {
    console.log(`Tenant already exists: ${existing.name} (slug=${slug}, id=${existing.id}) — no changes made.`);
    db.close();
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO restaurants (slug, name, http_user, http_pass_hash) VALUES (?, ?, ?, ?)'
  ).run(slug, name, httpUser, hash);

  console.log(`Created tenant: ${name}`);
  console.log(`  slug:     ${slug}   →   /${slug}  (landing), /${slug}/de (admin)`);
  console.log(`  admin user: ${httpUser}`);
  console.log(`  db:       ${dbPath}`);
  console.log(`  id:       ${result.lastInsertRowid}`);
  db.close();
}

main().catch((err) => {
  console.error('create-tenant failed:', err);
  process.exit(1);
});
