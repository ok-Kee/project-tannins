## Why

Every restaurant has distinct branding, and a tool that looks identical across all clients feels generic. Storing two brand colors per restaurant and deriving a full theme from them lets Tannins present as a bespoke product for each venue without requiring per-deployment builds or design work.

## What Changes

- Add `theme_accent` and `theme_bg` columns to the `restaurants` table (nullable TEXT)
- `GET /api/:slug/restaurant` returns the new color fields alongside existing data
- `PUT /api/:slug/restaurant` accepts and persists `theme_accent` and `theme_bg`
- Client-side `applyTheme(accent, bg)` utility derives and applies a full set of CSS custom properties on every page load
- Admin page logo section gains two `<input type="color">` pickers with live preview
- Tannins Bar seeded with `theme_accent=#C9A84C` (gold) and `theme_bg=#0A0A0A` (black)

## Capabilities

### New Capabilities

- `restaurant-theming`: Per-restaurant color theme — two brand colors stored in DB, derived into full CSS variable set and applied on page load across all four pages (landing, server, cuisine, admin)

### Modified Capabilities

- `restaurant-logo`: Admin logo section now also contains theme color pickers and live preview; `PUT /api/:slug/restaurant` accepts theme color fields in addition to the logo image

## Impact

- `scripts/db-init.js` — two new `ALTER TABLE` additions for `theme_accent` and `theme_bg`
- `src/routes/restaurant.js` — GET and PUT handlers updated to include theme fields
- `public/landing/index.html`, `public/server/index.html`, `public/cuisine/index.html`, `public/admin/index.html` — `applyTheme()` added and called after restaurant fetch
- No new npm dependencies
- No breaking changes — pages with no theme set fall back to existing hardcoded CSS variables
