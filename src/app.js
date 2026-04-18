require('dotenv').config();
const express = require('express');
const path = require('path');
const { basicAuth } = require('./auth');
const beveragesRouter = require('./routes/beverages');
const racksRouter = require('./routes/racks');
const wineListRouter = require('./routes/wineList');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Beverages — fully public
app.use('/api/beverages', beveragesRouter);

// Racks — GET public, POST auth-gated
app.use('/api/:slug/racks', (req, res, next) => {
  if (req.method === 'POST') return basicAuth(req, res, next);
  next();
}, racksRouter);

// Wine list — GETs public, mutations auth-gated
app.use('/api/:slug/wine-list', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') return basicAuth(req, res, next);
  next();
}, wineListRouter);

// Admin UI — Phase 1 (auth required)
app.get('/waitingfortips/:slug/de', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Server lookup UI — Phase 2 (no auth)
app.get('/waitingfortips/:slug/server', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/server/index.html'));
});

app.listen(PORT, () => {
  console.log(`Tannins running at http://localhost:${PORT}`);
});
