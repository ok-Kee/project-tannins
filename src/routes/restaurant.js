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
  const row = db.prepare('SELECT name, logo_image_path FROM restaurants WHERE slug = ?').get(req.params.slug);
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

    if (req.file) {
      const logoPath = path.join('uploads', slug, req.file.filename);
      db.prepare('UPDATE restaurants SET logo_image_path = ? WHERE id = ?').run(logoPath, restaurant.id);
      return res.json({ logo_image_path: logoPath });
    }
    res.json({ logo_image_path: restaurant.logo_image_path });
  });
});

module.exports = router;
