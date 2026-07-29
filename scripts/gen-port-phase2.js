// Generates a portable, additive SQL file that copies the reviewed Phase 2 data
// (beverage flavor profiles + menu_item_pairings with their notes) from THIS local DB
// onto another DB (prod) by matching on natural keys (beverage name+type, dish name),
// so it works despite local/prod auto-increment IDs differing. Both DBs came from the
// same deterministic Phase 1 load, so names line up.
//
// Run locally:  node scripts/gen-port-phase2.js
// Apply on prod (Render shell), after the code deploy adds the columns via db-init:
//   cp /data/tannins.db /data/tannins.db.bak.$(date +%s)
//   sqlite3 /data/tannins.db < data/mountain-prime/port-mp-phase2.sql
require('dotenv').config();
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SLUG = process.env.RESTAURANT_SLUG || 'mountain-prime';
const dbPath = process.env.DB_PATH || './db/tannins.db';
const OUT = path.join('data', 'mountain-prime', 'port-mp-phase2.sql');

const db = new Database(dbPath, { readonly: true });
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const qn = (s) => (s == null || s === '' ? 'NULL' : q(s));

const rid = db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(SLUG)?.id;
if (!rid) { console.error('No tenant', SLUG); process.exit(1); }

// Flavor profiles: every beverage this tenant carries that has one (fill-only on prod).
const flavors = db.prepare(`
  SELECT DISTINCT b.name, b.type, b.flavor_profile AS flavor
  FROM wine_list wl JOIN beverages b ON b.id = wl.beverage_id
  WHERE wl.restaurant_id = ? AND b.flavor_profile IS NOT NULL AND b.flavor_profile != ''
  ORDER BY b.name
`).all(rid);

// Pairings: keyed by dish name + catalog beverage name/type, carrying the notes.
const pairings = db.prepare(`
  SELECT mi.name AS dish, b.name AS bev, b.type AS bevtype,
         mip.ai_pairing_text AS ai, mip.house_pairing_text AS house, mip.sort_order AS sort
  FROM menu_item_pairings mip
  JOIN wine_list wl ON wl.id = mip.wine_list_id
  JOIN beverages b ON b.id = wl.beverage_id
  JOIN menu_items mi ON mi.id = mip.menu_item_id
  WHERE wl.restaurant_id = ?
  ORDER BY mi.name, b.name
`).all(rid);

const L = [];
L.push(`-- Mountain Prime Phase 2 data port — generated ${new Date().toISOString()}`);
L.push(`-- Additive + idempotent. Matches prod rows by name; never touches other tenants.`);
L.push(`-- Apply: cp /data/tannins.db /data/tannins.db.bak.$(date +%s) && sqlite3 /data/tannins.db < ${OUT}`);
L.push('BEGIN;');
L.push('');
L.push('-- ===== Flavor profiles (fill-only, matched by beverage name+type) =====');
L.push('CREATE TEMP TABLE _pf (name TEXT, type TEXT, flavor TEXT);');
L.push('INSERT INTO _pf (name,type,flavor) VALUES');
L.push(flavors.map(f => `  (${q(f.name)},${q(f.type)},${q(f.flavor)})`).join(',\n') + ';');
L.push('');
L.push(`SELECT '!! UNMATCHED FLAVOR BEVERAGE: ' || name || ' [' || type || ']'`);
L.push('  FROM _pf f WHERE NOT EXISTS (SELECT 1 FROM beverages b WHERE b.name=f.name AND b.type=f.type);');
L.push('');
L.push('UPDATE beverages SET flavor_profile =');
L.push('    (SELECT f.flavor FROM _pf f WHERE f.name=beverages.name AND f.type=beverages.type)');
L.push("  WHERE (flavor_profile IS NULL OR flavor_profile='')");
L.push('    AND EXISTS (SELECT 1 FROM _pf f WHERE f.name=beverages.name AND f.type=beverages.type);');
L.push('');
L.push('-- ===== Menu pairings (matched by dish name + beverage name/type, tenant-scoped) =====');
L.push('CREATE TEMP TABLE _pp (dish TEXT, bev TEXT, bevtype TEXT, ai TEXT, house TEXT, sort INT);');
L.push('INSERT INTO _pp (dish,bev,bevtype,ai,house,sort) VALUES');
L.push(pairings.map(p => `  (${q(p.dish)},${q(p.bev)},${q(p.bevtype)},${qn(p.ai)},${qn(p.house)},${p.sort || 0})`).join(',\n') + ';');
L.push('');
L.push(`SELECT '!! UNMATCHED PAIRING DISH: ' || dish FROM _pp p WHERE NOT EXISTS`);
L.push(`  (SELECT 1 FROM menu_items mi JOIN restaurants r ON r.id=mi.restaurant_id WHERE r.slug=${q(SLUG)} AND mi.name=p.dish);`);
L.push(`SELECT '!! UNMATCHED PAIRING BEVERAGE: ' || bev FROM _pp p WHERE NOT EXISTS`);
L.push(`  (SELECT 1 FROM wine_list wl JOIN beverages b ON b.id=wl.beverage_id JOIN restaurants r ON r.id=wl.restaurant_id WHERE r.slug=${q(SLUG)} AND b.name=p.bev AND b.type=p.bevtype);`);
L.push('');
L.push('INSERT OR IGNORE INTO menu_item_pairings (menu_item_id, wine_list_id, ai_pairing_text, house_pairing_text, sort_order)');
L.push('  SELECT mi.id, wl.id, p.ai, p.house, p.sort');
L.push('  FROM _pp p');
L.push(`  JOIN restaurants r ON r.slug=${q(SLUG)}`);
L.push('  JOIN menu_items mi ON mi.restaurant_id=r.id AND mi.name=p.dish');
L.push('  JOIN wine_list wl ON wl.restaurant_id=r.id');
L.push('  JOIN beverages b ON b.id=wl.beverage_id AND b.name=p.bev AND b.type=p.bevtype;');
L.push('');
L.push('COMMIT;');
L.push('');
L.push('-- Summary (should match the local counts printed by the generator):');
L.push(`SELECT 'flavor filled (global): ' || COUNT(*) FROM beverages WHERE flavor_profile IS NOT NULL AND flavor_profile!='';`);
L.push(`SELECT 'MP pairings total: ' || COUNT(*) FROM menu_item_pairings mip JOIN wine_list wl ON wl.id=mip.wine_list_id JOIN restaurants r ON r.id=wl.restaurant_id WHERE r.slug=${q(SLUG)};`);

fs.writeFileSync(OUT, L.join('\n') + '\n');
db.close();
console.log(`Wrote ${OUT}`);
console.log(`  flavor rows: ${flavors.length}`);
console.log(`  pairing rows: ${pairings.length}`);
