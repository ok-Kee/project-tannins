const express = require('express');
const db = require('../db');
const { basicAuth } = require('../auth');
const router = express.Router({ mergeParams: true });

function getRestaurantId(slug) {
  return db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(slug)?.id;
}

// GET / — list menu items
router.get('/', (req, res) => {
  const restaurantId = getRestaurantId(req.params.slug);
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const rows = db.prepare(
    'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY sort_order ASC, name ASC'
  ).all(restaurantId);
  res.json(rows);
});

// POST / — create menu item
router.post('/', basicAuth, (req, res) => {
  const restaurantId = req.restaurant?.id || getRestaurantId(req.params.slug);
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const { name, description, category, sort_order, price } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare(
    'INSERT INTO menu_items (restaurant_id, name, description, category, sort_order, price) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(restaurantId, name, description || null, category || null, sort_order || 0, price != null ? price : null);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /:id — update menu item
router.put('/:id', basicAuth, (req, res) => {
  const restaurantId = req.restaurant?.id || getRestaurantId(req.params.slug);
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?').get(req.params.id, restaurantId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, description, category, sort_order, price } = req.body;
  db.prepare(
    'UPDATE menu_items SET name = ?, description = ?, category = ?, sort_order = ?, price = ? WHERE id = ?'
  ).run(
    name ?? existing.name,
    description !== undefined ? description : existing.description,
    category !== undefined ? category : existing.category,
    sort_order !== undefined ? sort_order : existing.sort_order,
    price !== undefined ? price : existing.price,
    req.params.id
  );
  res.json({ id: Number(req.params.id) });
});

// DELETE /:id — delete menu item (cascades pairings via FK)
router.delete('/:id', basicAuth, (req, res) => {
  const restaurantId = req.restaurant?.id || getRestaurantId(req.params.slug);
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const existing = db.prepare('SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?').get(req.params.id, restaurantId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.json({ id: Number(req.params.id) });
});

// GET /:id/pairings — list pairings with full beverage details
router.get('/:id/pairings', (req, res) => {
  const restaurantId = getRestaurantId(req.params.slug);
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const item = db.prepare('SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?').get(req.params.id, restaurantId);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  const rows = db.prepare(`
    SELECT mip.id AS pairing_id, mip.sort_order,
           wl.id AS wine_list_id, wl.price_btg, wl.price_btl,
           wl.sommelier_comments, wl.house_pairing, wl.snack_notes,
           wl.label_image_path, wl.bottle_image_path,
           COALESCE(wl.house_name, b.name) AS beverage_name,
           COALESCE(wl.house_type, b.type) AS beverage_type, b.general_pairing,
           r.rack_number
    FROM menu_item_pairings mip
    JOIN wine_list wl ON wl.id = mip.wine_list_id
    JOIN beverages b ON b.id = wl.beverage_id
    LEFT JOIN racks r ON r.id = wl.rack_id
    WHERE mip.menu_item_id = ?
    ORDER BY mip.sort_order ASC, b.name ASC
  `).all(req.params.id);
  res.json(rows);
});

// POST /:id/pairings — add a pairing
router.post('/:id/pairings', basicAuth, (req, res) => {
  const restaurantId = req.restaurant?.id || getRestaurantId(req.params.slug);
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const item = db.prepare('SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?').get(req.params.id, restaurantId);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  const { wine_list_id } = req.body;
  if (!wine_list_id) return res.status(400).json({ error: 'wine_list_id required' });
  // Verify wine_list entry belongs to this restaurant
  const wlEntry = db.prepare('SELECT id FROM wine_list WHERE id = ? AND restaurant_id = ?').get(wine_list_id, restaurantId);
  if (!wlEntry) return res.status(404).json({ error: 'Wine list entry not found' });
  try {
    const result = db.prepare(
      'INSERT INTO menu_item_pairings (menu_item_id, wine_list_id) VALUES (?, ?)'
    ).run(req.params.id, wine_list_id);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Pairing already exists' });
    throw e;
  }
});

// DELETE /:id/pairings/:pairingId — remove a pairing
router.delete('/:id/pairings/:pairingId', basicAuth, (req, res) => {
  const existing = db.prepare(
    'SELECT id FROM menu_item_pairings WHERE id = ? AND menu_item_id = ?'
  ).get(req.params.pairingId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM menu_item_pairings WHERE id = ?').run(req.params.pairingId);
  res.json({ id: Number(req.params.pairingId) });
});

module.exports = router;
