const express = require('express');
const db = require('../db');
const router = express.Router({ mergeParams: true });

router.get('/', (req, res) => {
  const restaurant = db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
  const rows = db.prepare('SELECT id, rack_number FROM racks WHERE restaurant_id = ? ORDER BY rack_number').all(restaurant.id);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { rack_number } = req.body;
  if (!rack_number) return res.status(400).json({ error: 'rack_number required' });
  const restaurantId = req.restaurant.id;
  const result = db.prepare('INSERT INTO racks (restaurant_id, rack_number) VALUES (?, ?)').run(restaurantId, rack_number);
  res.status(201).json({ id: result.lastInsertRowid, rack_number });
});

module.exports = router;
