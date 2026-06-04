## 1. Schema Changes

- [x] 1.1 Add idempotent `ALTER TABLE restaurants ADD COLUMN theme_accent TEXT` in `scripts/db-init.js`
- [x] 1.2 Add idempotent `ALTER TABLE restaurants ADD COLUMN theme_bg TEXT` in `scripts/db-init.js`
- [x] 1.3 Verify `npm run db:init` runs cleanly against existing database

## 2. Restaurant API

- [x] 2.1 Update `GET /api/:slug/restaurant` handler in `src/routes/restaurant.js` to include `theme_accent` and `theme_bg` in the response
- [x] 2.2 Update `PUT /api/:slug/restaurant` handler in `src/routes/restaurant.js` to read optional `theme_accent` and `theme_bg` from the request body and persist them to the database

## 3. applyTheme Utility

- [x] 3.1 Implement `hexToHsl(hex)` helper in each page's inline JS (or shared inline block): converts a CSS hex string to `[h, s, l]`
- [x] 3.2 Implement `hslToHex(h, s, l)` helper: converts HSL back to a CSS hex string
- [x] 3.3 Implement `applyTheme(accent, bg)` function: returns early if either argument is null/undefined; otherwise derives all seven CSS variables per the design derivation table and sets them on `document.documentElement.style`

## 4. Page Integration

- [x] 4.1 Add `applyTheme` utility and call `applyTheme(data.theme_accent, data.theme_bg)` after the restaurant fetch in `public/landing/index.html`
- [x] 4.2 Add `applyTheme` utility and call `applyTheme(data.theme_accent, data.theme_bg)` after the restaurant fetch in `public/server/index.html`
- [x] 4.3 Add `applyTheme` utility and call `applyTheme(data.theme_accent, data.theme_bg)` after the restaurant fetch in `public/cuisine/index.html`
- [x] 4.4 Add `applyTheme` utility and call `applyTheme(data.theme_accent, data.theme_bg)` after the restaurant fetch in `public/admin/index.html`

## 5. Admin Theme Color Pickers

- [x] 5.1 Add "Accent Color" `<input type="color">` to the logo section in `public/admin/index.html`
- [x] 5.2 Add "Background Color" `<input type="color">` to the logo section in `public/admin/index.html`
- [x] 5.3 Pre-fill color pickers from `theme_accent` / `theme_bg` when the admin page loads; fall back to `#9b3f5e` / `#1c1a18` when values are null
- [x] 5.4 Wire `input` event on both pickers to call `applyTheme()` with the current picker values for live preview
- [x] 5.5 Include `theme_accent` and `theme_bg` picker values in the logo Save form submission (append to FormData before `PUT /api/:slug/restaurant`)

## 6. Tannins Bar Seed

- [x] 6.1 Add a seed step (or one-liner comment in `scripts/db-init.js`) that sets `theme_accent = '#C9A84C'` and `theme_bg = '#0A0A0A'` for the Tannins Bar restaurant record
