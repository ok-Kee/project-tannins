## Why

Servers currently have no entry point to the tool — they must know a long `/waitingfortips/{slug}/server` URL — and there is no reverse workflow for recommending a beverage based on a food order. Adding a landing page, shorter URLs, cross-page navigation, and a cuisine pairing feature makes Tannins a complete table-side tool and a stronger demo for prospective restaurant partners.

## What Changes

- **BREAKING** — All route prefixes change: `/waitingfortips/{slug}/...` → `/{slug}/...`
- New landing page at `/{slug}` with restaurant logo and navigation to Beverages or Cuisine
- Restaurant logo upload: new `logo_image_path` field on `restaurants` table, upload UI in admin
- Cross-page navigation buttons added to admin and server page headers (open in new tab)
- Drink category filter chips on the server lookup page (dynamically generated from wine list types)
- New Cuisine feature: menu items CRUD in admin, per-item beverage pairing management, and a server-facing cuisine lookup page at `/{slug}/cuisine`

## Capabilities

### New Capabilities

- `landing-page`: Per-restaurant landing page at `/{slug}` showing logo placeholder and navigation buttons to Beverages and Cuisine server pages
- `restaurant-logo`: `logo_image_path` column on `restaurants` table; upload UI in admin; logo rendered on landing page
- `cross-page-nav`: Navigation buttons in page headers linking admin ↔ server ↔ cuisine (all open in new tab)
- `category-filters`: Horizontal filter chip row on the server lookup page; chips dynamically sourced from distinct `beverage_type` values; stacks with existing rack/name filters
- `menu-items`: Admin CRUD for per-restaurant menu items (`menu_items` table: id, restaurant_id, name, description, category, sort_order)
- `menu-item-pairings`: Per-menu-item beverage pairing management in admin; `menu_item_pairings` join table; full API (list, add, remove)
- `cuisine-server-page`: Server-facing `/{slug}/cuisine` page listing menu items grouped by category; selecting a dish reveals its paired beverages; tapping a beverage opens the existing detail modal

### Modified Capabilities

- `server-lookup`: URL changes from `/waitingfortips/{slug}/server` to `/{slug}/server` (**BREAKING**)
- `admin-entry`: URL changes from `/waitingfortips/{slug}/de` to `/{slug}/de` (**BREAKING**)

## Impact

- `src/app.js` — route paths updated, new routes for landing, cuisine page, menu-items API, and menu-item-pairings API
- `src/routes/` — new `menuItems.js` router
- `scripts/db-init.js` — schema additions: `logo_image_path` on `restaurants`, new `menu_items` and `menu_item_pairings` tables
- `public/admin/index.html` — logo upload section, menu items section, pairing management section, nav button
- `public/server/index.html` — category filter chips, nav button
- `public/landing/index.html` — new file
- `public/cuisine/index.html` — new file
- No new npm dependencies required
- Deployed URL bookmarks will break (BREAKING route change); Render config unchanged
