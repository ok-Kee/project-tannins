const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const router = express.Router({ mergeParams: true });

function getUploadDir(slug) {
  const dir = path.join(__dirname, '../../uploads', slug);
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
    SELECT wl.*, b.name AS beverage_name, b.type AS beverage_type, b.general_pairing,
           r.rack_number
    FROM wine_list wl
    JOIN beverages b ON b.id = wl.beverage_id
    LEFT JOIN racks r ON r.id = wl.rack_id
    WHERE wl.restaurant_id = ?
    ORDER BY b.name
  `).all(restaurantId);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const restaurantId = req.restaurant?.id || db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
  const row = db.prepare(`
    SELECT wl.*, b.name AS beverage_name, b.type AS beverage_type, b.general_pairing,
           r.rack_number
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
    const { beverage_id, rack_id, sommelier_comments, house_pairing, snack_notes, price_btl, price_btg } = req.body;
    if (!beverage_id) return res.status(400).json({ error: 'beverage_id required' });

    const labelPath = req.files?.label_image?.[0]?.path ? path.relative(process.cwd(), req.files.label_image[0].path) : null;
    const bottlePath = req.files?.bottle_image?.[0]?.path ? path.relative(process.cwd(), req.files.bottle_image[0].path) : null;

    const result = db.prepare(`
      INSERT INTO wine_list (restaurant_id, beverage_id, rack_id, sommelier_comments, house_pairing, snack_notes, price_btl, price_btg, label_image_path, bottle_image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(restaurantId, beverage_id, rack_id || null, sommelier_comments || null, house_pairing || null, snack_notes || null, price_btl || null, price_btg || null, labelPath, bottlePath);

    res.status(201).json({ id: result.lastInsertRowid });
  });
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

    const { beverage_id, rack_id, sommelier_comments, house_pairing, snack_notes, price_btl, price_btg } = req.body;

    const labelPath = req.files?.label_image?.[0]?.path
      ? path.relative(process.cwd(), req.files.label_image[0].path)
      : existing.label_image_path;
    const bottlePath = req.files?.bottle_image?.[0]?.path
      ? path.relative(process.cwd(), req.files.bottle_image[0].path)
      : existing.bottle_image_path;

    db.prepare(`
      UPDATE wine_list SET
        beverage_id = ?, rack_id = ?, sommelier_comments = ?, house_pairing = ?,
        snack_notes = ?, price_btl = ?, price_btg = ?, label_image_path = ?,
        bottle_image_path = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND restaurant_id = ?
    `).run(
      beverage_id || existing.beverage_id,
      rack_id || null,
      sommelier_comments ?? existing.sommelier_comments,
      house_pairing ?? existing.house_pairing,
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
