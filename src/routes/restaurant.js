const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { basicAuth } = require('../auth');
const router = express.Router({ mergeParams: true });

function getUploadDir(slug) {
  const root = process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'uploads')
    : path.join(__dirname, '../../uploads');
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png'];

router.get('/', (req, res) => {
  const row = db.prepare('SELECT name, logo_image_path, theme_accent, theme_bg FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.put('/', basicAuth, (req, res) => {
  const slug = req.params.slug;
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, getUploadDir(slug)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `logo-${Date.now()}${ext}`);
    },
  });
  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
      cb(Object.assign(new Error('Only JPG/PNG images are accepted'), { status: 400 }), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }).single('logo_image');

  upload(req, res, (err) => {
    if (err) return res.status(err.status || 500).json({ error: err.message });

    const restaurant = req.restaurant;
    if (!restaurant) return res.status(404).json({ error: 'Not found' });

    const updates = [];
    const params = [];

    if (req.file) {
      updates.push('logo_image_path = ?');
      params.push(path.join('uploads', slug, req.file.filename));
    }
    if (req.body.theme_accent !== undefined) {
      updates.push('theme_accent = ?');
      params.push(req.body.theme_accent || null);
    }
    if (req.body.theme_bg !== undefined) {
      updates.push('theme_bg = ?');
      params.push(req.body.theme_bg || null);
    }

    if (updates.length) {
      params.push(restaurant.id);
      db.prepare(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT logo_image_path, theme_accent, theme_bg FROM restaurants WHERE id = ?').get(restaurant.id);
    res.json(updated);
  });
});

module.exports = router;
