const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const rows = db.prepare(
    'SELECT id, name, type, general_pairing, flavor_profile FROM beverages WHERE name LIKE ? ORDER BY name LIMIT 50'
  ).all(q);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, type } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });
  const existing = db.prepare('SELECT id FROM beverages WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ id: existing.id, existing: true });
  const result = db.prepare('INSERT INTO beverages (name, type) VALUES (?, ?)').run(name, type);
  res.status(201).json({ id: result.lastInsertRowid });
});

module.exports = router;
