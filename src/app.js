require('dotenv').config();
const express = require('express');
const path = require('path');
const { basicAuth } = require('./auth');
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

// Beverages — fully public
app.use('/api/beverages', beveragesRouter);

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
