const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const router = express.Router({ mergeParams: true });

function getUploadDir(slug) {
  const root = process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'uploads')
    : path.join(__dirname, '../../uploads');
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeStorage(slug) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, getUploadDir(slug)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
}

const IMAGE_TYPES = ['image/jpeg', 'image/png'];

function fileFilter(req, file, cb) {
  if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(Object.assign(new Error('Only JPG/PNG images are accepted'), { status: 400 }), false);
}

router.get('/', (req, res) => {
  const restaurantId = req.restaurant
    ? req.restaurant.id
    : db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });

  const rows = db.prepare(`
    SELECT wl.*, COALESCE(wl.house_name, b.name) AS beverage_name,
           COALESCE(wl.house_type, b.type) AS beverage_type,
           b.name AS catalog_name, b.type AS catalog_type,
           b.general_pairing, b.flavor_profile, r.rack_number
    FROM wine_list wl
    JOIN beverages b ON b.id = wl.beverage_id
    LEFT JOIN racks r ON r.id = wl.rack_id
    WHERE wl.restaurant_id = ?
    ORDER BY COALESCE(wl.house_name, b.name)
  `).all(restaurantId);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const restaurantId = req.restaurant?.id || db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
  const row = db.prepare(`
    SELECT wl.*, COALESCE(wl.house_name, b.name) AS beverage_name,
           COALESCE(wl.house_type, b.type) AS beverage_type,
           b.name AS catalog_name, b.type AS catalog_type,
           b.general_pairing, b.flavor_profile, r.rack_number
    FROM wine_list wl
    JOIN beverages b ON b.id = wl.beverage_id
    LEFT JOIN racks r ON r.id = wl.rack_id
    WHERE wl.id = ? AND wl.restaurant_id = ?
  `).get(req.params.id, restaurantId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const slug = req.params.slug;
  const upload = multer({ storage: makeStorage(slug), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })
    .fields([{ name: 'label_image' }, { name: 'bottle_image' }]);

  upload(req, res, (err) => {
    if (err) return res.status(err.status || 500).json({ error: err.message });

    const restaurantId = req.restaurant.id;
    const { beverage_id, rack_id, sommelier_comments, house_pairing, house_flavor_profile, house_name, house_type, snack_notes, price_btl, price_btg } = req.body;
    if (!beverage_id) return res.status(400).json({ error: 'beverage_id required' });

    const labelPath = req.files?.label_image?.[0] ? path.join('uploads', slug, req.files.label_image[0].filename) : null;
    const bottlePath = req.files?.bottle_image?.[0] ? path.join('uploads', slug, req.files.bottle_image[0].filename) : null;

    const result = db.prepare(`
      INSERT INTO wine_list (restaurant_id, beverage_id, rack_id, sommelier_comments, house_pairing, house_flavor_profile, house_name, house_type, snack_notes, price_btl, price_btg, label_image_path, bottle_image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(restaurantId, beverage_id, rack_id || null, sommelier_comments || null, house_pairing || null, house_flavor_profile || null, house_name || null, house_type || null, snack_notes || null, price_btl || null, price_btg || null, labelPath, bottlePath);

    res.status(201).json({ id: result.lastInsertRowid });
  });
});

router.delete('/:id', (req, res) => {
  const restaurantId = req.restaurant?.id || db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const existing = db.prepare('SELECT id FROM wine_list WHERE id = ? AND restaurant_id = ?').get(req.params.id, restaurantId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM wine_list WHERE id = ?').run(req.params.id);
  res.json({ id: Number(req.params.id) });
});

router.get('/:id/pairings', (req, res) => {
  const restaurantId = req.restaurant?.id || db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const wl = db.prepare('SELECT id FROM wine_list WHERE id = ? AND restaurant_id = ?').get(req.params.id, restaurantId);
  if (!wl) return res.status(404).json({ error: 'Not found' });
  const rows = db.prepare(`
    SELECT mip.id AS pairing_id, mip.sort_order,
           mip.ai_pairing_text, mip.house_pairing_text,
           mi.id AS menu_item_id, mi.name, mi.category, mi.description
    FROM menu_item_pairings mip
    JOIN menu_items mi ON mi.id = mip.menu_item_id
    WHERE mip.wine_list_id = ?
    ORDER BY mip.sort_order ASC, mi.name ASC
  `).all(req.params.id);
  res.json(rows);
});

// PATCH /:id/pairings/:pairingId — edit the restaurant's per-entry pairing note
router.patch('/:id/pairings/:pairingId', (req, res) => {
  const restaurantId = req.restaurant?.id || db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const existing = db.prepare(
    'SELECT mip.id FROM menu_item_pairings mip JOIN wine_list wl ON wl.id = mip.wine_list_id WHERE mip.id = ? AND mip.wine_list_id = ? AND wl.restaurant_id = ?'
  ).get(req.params.pairingId, req.params.id, restaurantId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { house_pairing_text } = req.body;
  const value = house_pairing_text && house_pairing_text.trim() ? house_pairing_text : null;
  db.prepare('UPDATE menu_item_pairings SET house_pairing_text = ? WHERE id = ?').run(value, req.params.pairingId);
  res.json({ id: Number(req.params.pairingId), house_pairing_text: value });
});

router.post('/:id/pairings', (req, res) => {
  const restaurantId = req.restaurant?.id || db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const wl = db.prepare('SELECT id FROM wine_list WHERE id = ? AND restaurant_id = ?').get(req.params.id, restaurantId);
  if (!wl) return res.status(404).json({ error: 'Not found' });
  const { menu_item_id } = req.body;
  if (!menu_item_id) return res.status(400).json({ error: 'menu_item_id required' });
  const mi = db.prepare('SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?').get(menu_item_id, restaurantId);
  if (!mi) return res.status(404).json({ error: 'Menu item not found' });
  try {
    const result = db.prepare('INSERT INTO menu_item_pairings (menu_item_id, wine_list_id) VALUES (?, ?)').run(menu_item_id, req.params.id);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Pairing already exists' });
    throw e;
  }
});

router.delete('/:id/pairings/:pairingId', (req, res) => {
  const restaurantId = req.restaurant?.id || db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
  if (!restaurantId) return res.status(404).json({ error: 'Restaurant not found' });
  const existing = db.prepare(
    'SELECT mip.id FROM menu_item_pairings mip JOIN wine_list wl ON wl.id = mip.wine_list_id WHERE mip.id = ? AND mip.wine_list_id = ? AND wl.restaurant_id = ?'
  ).get(req.params.pairingId, req.params.id, restaurantId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM menu_item_pairings WHERE id = ?').run(req.params.pairingId);
  res.json({ id: Number(req.params.pairingId) });
});

router.put('/:id', (req, res) => {
  const slug = req.params.slug;
  const upload = multer({ storage: makeStorage(slug), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })
    .fields([{ name: 'label_image' }, { name: 'bottle_image' }]);

  upload(req, res, (err) => {
    if (err) return res.status(err.status || 500).json({ error: err.message });

    const restaurantId = req.restaurant.id;
    const existing = db.prepare('SELECT * FROM wine_list WHERE id = ? AND restaurant_id = ?').get(req.params.id, restaurantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { beverage_id, rack_id, sommelier_comments, house_pairing, house_flavor_profile, house_name, house_type, snack_notes, price_btl, price_btg } = req.body;

    const labelPath = req.files?.label_image?.[0]
      ? path.join('uploads', slug, req.files.label_image[0].filename)
      : existing.label_image_path;
    const bottlePath = req.files?.bottle_image?.[0]
      ? path.join('uploads', slug, req.files.bottle_image[0].filename)
      : existing.bottle_image_path;

    db.prepare(`
      UPDATE wine_list SET
        beverage_id = ?, rack_id = ?, sommelier_comments = ?, house_pairing = ?,
        house_flavor_profile = ?, house_name = ?, house_type = ?, snack_notes = ?,
        price_btl = ?, price_btg = ?, label_image_path = ?,
        bottle_image_path = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND restaurant_id = ?
    `).run(
      beverage_id || existing.beverage_id,
      rack_id || null,
      sommelier_comments ?? existing.sommelier_comments,
      house_pairing ?? existing.house_pairing,
      house_flavor_profile ?? existing.house_flavor_profile,
      house_name !== undefined ? (house_name || null) : existing.house_name,
      house_type !== undefined ? (house_type || null) : existing.house_type,
      snack_notes ?? existing.snack_notes,
      price_btl ?? existing.price_btl,
      price_btg ?? existing.price_btg,
      labelPath, bottlePath,
      req.params.id, restaurantId
    );

    res.json({ id: Number(req.params.id) });
  });
});

module.exports = router;
