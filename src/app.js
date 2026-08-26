require('dotenv').config();
const express = require('express');
const path = require('path');
const { basicAuth } = require('./auth');
const db = require('./db');
const beveragesRouter = require('./routes/beverages');
const racksRouter = require('./routes/racks');
const wineListRouter = require('./routes/wineList');
const restaurantRouter = require('./routes/restaurant');
const menuItemsRouter = require('./routes/menuItems');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsRoot = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsRoot));
app.use('/public', express.static(path.join(__dirname, '../public')));

// ── API routes ─────────────────────────────────────────────────────────────

// Beverages — global shared catalog; GET (search) public, POST auth-gated so only
// an authenticated tenant can add to the catalog (the slug identifies the actor).
app.use('/api/:slug/beverages', (req, res, next) => {
  if (req.method === 'POST') return basicAuth(req, res, next);
  next();
}, beveragesRouter);

// Restaurant — GET public, PUT auth-gated
app.use('/api/:slug/restaurant', restaurantRouter);

// Racks — GET public, POST auth-gated
app.use('/api/:slug/racks', (req, res, next) => {
  if (req.method === 'POST') return basicAuth(req, res, next);
  next();
}, racksRouter);

// Wine list — GETs public, mutations auth-gated
app.use('/api/:slug/wine-list', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') return basicAuth(req, res, next);
  next();
}, wineListRouter);

// Menu items — GETs public, mutations auth-gated (auth applied per-route in router)
app.use('/api/:slug/menu-items', menuItemsRouter);

// ── Page routes ────────────────────────────────────────────────────────────

// Dynamic PWA manifest — per-tenant name and theme colours
app.get('/:slug/manifest.json', (req, res) => {
  const { slug } = req.params;
  const row = db.prepare('SELECT name, theme_accent, theme_bg FROM restaurants WHERE slug = ?').get(slug);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const manifest = {
    name: row.name,
    short_name: row.name,
    start_url: `/${slug}`,
    display: 'standalone',
    background_color: row.theme_bg || '#1a1a1a',
    theme_color: row.theme_accent || '#8b2252',
    // TODO: add proper 192×192 and 512×512 PNG icons per tenant or as shared assets
    icons: [
      { src: '/public/easily-paired-logo.jpg', sizes: '512x512', type: 'image/jpeg' },
    ],
  };
  res.setHeader('Content-Type', 'application/manifest+json');
  res.json(manifest);
});

// Admin UI — auth required
app.get('/:slug/de', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Server lookup UI — no auth
app.get('/:slug/server', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/server/index.html'));
});

// Cuisine lookup UI — no auth
app.get('/:slug/cuisine', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/cuisine/index.html'));
});

// Landing page — no auth (must be last slug route)
app.get('/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing/index.html'));
});

app.listen(PORT, () => {
  console.log(`Tannins running at http://localhost:${PORT}`);
});
