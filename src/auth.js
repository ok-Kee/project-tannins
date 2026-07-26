const bcrypt = require('bcrypt');
const db = require('./db');

function basicAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Basic ')) {
    return res.set('WWW-Authenticate', 'Basic realm="Easily Paired Admin"').status(401).json({ error: 'Authentication required' });
  }

  const slug = req.params.slug;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) {
    return res.set('WWW-Authenticate', 'Basic realm="Easily Paired Admin"').status(401).json({ error: 'Invalid credentials' });
  }

  const username = decoded.slice(0, colonIdx);
  const password = decoded.slice(colonIdx + 1);

  const restaurant = db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(slug);
  if (!restaurant || restaurant.http_user !== username) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  bcrypt.compare(password, restaurant.http_pass_hash, (err, match) => {
    if (err || !match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.restaurant = restaurant;
    next();
  });
}

module.exports = { basicAuth };
