## 1. Schema Changes

- [x] 1.1 Add `logo_image_path TEXT` column to `restaurants` table in `scripts/db-init.js` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- [x] 1.2 Add `menu_items` table definition to `scripts/db-init.js`
- [x] 1.3 Add `menu_item_pairings` table definition to `scripts/db-init.js` with `ON DELETE CASCADE` and unique constraint on `(menu_item_id, wine_list_id)`
- [x] 1.4 Verify `npm run db:init` runs cleanly against existing database (idempotent)

## 2. URL Restructuring

- [x] 2.1 Update `src/app.js` admin route from `/waitingfortips/:slug/de` to `/:slug/de`
- [x] 2.2 Update `src/app.js` server lookup route from `/waitingfortips/:slug/server` to `/:slug/server`
- [x] 2.3 Add new route `/:slug` for landing page in `src/app.js`
- [x] 2.4 Add new route `/:slug/cuisine` for cuisine page in `src/app.js`
- [x] 2.5 Update slug extraction in `public/server/index.html` JS (`location.pathname.split('/')`) to reflect new URL depth
- [x] 2.6 Verify all existing API routes (`/api/:slug/...`) are unaffected

## 3. Restaurant Logo API

- [x] 3.1 Add `PUT /api/:slug/restaurant` route in `src/app.js` (auth-gated, multipart via Multer)
- [x] 3.2 Implement handler: store uploaded logo to `/uploads/{slug}/`, update `restaurants.logo_image_path`, respond 200 with updated path
- [x] 3.3 Add `GET /api/:slug/restaurant` route returning restaurant name and `logo_image_path` (public)

## 4. Menu Items API

- [x] 4.1 Create `src/routes/menuItems.js` router with `mergeParams: true`
- [x] 4.2 Implement `GET /` — list menu items ordered by `sort_order ASC, name ASC`
- [x] 4.3 Implement `POST /` — create menu item (auth-gated); validate `name` required; return `{ id }`
- [x] 4.4 Implement `PUT /:id` — update menu item fields (auth-gated); 404 if not found
- [x] 4.5 Implement `DELETE /:id` — delete menu item (cascades to pairings via FK); return 200
- [x] 4.6 Mount router in `src/app.js` at `/api/:slug/menu-items` with auth gate on mutations

## 5. Menu Item Pairings API

- [x] 5.1 Add pairing sub-routes to `src/routes/menuItems.js`: `GET /:id/pairings`, `POST /:id/pairings`, `DELETE /:id/pairings/:pairingId`
- [x] 5.2 Implement `GET /:id/pairings` — JOIN `menu_item_pairings` → `wine_list` → `beverages` → `racks`; return full beverage details ordered by `sort_order`
- [x] 5.3 Implement `POST /:id/pairings` — validate `wine_list_id` present and belongs to restaurant; insert pairing; return 409 on duplicate; return `{ id }`
- [x] 5.4 Implement `DELETE /:id/pairings/:pairingId` — delete pairing record; 404 if not found

## 6. Landing Page

- [x] 6.1 Create `public/landing/index.html` with the established dark theme CSS variables
- [x] 6.2 Fetch `GET /api/:slug/restaurant` on load to get restaurant name and logo path
- [x] 6.3 Render logo image if `logo_image_path` is set, otherwise render placeholder graphic
- [x] 6.4 Add "Beverages" button linking to `/{slug}/server` and "Cuisine" button linking to `/{slug}/cuisine`
- [x] 6.5 Style buttons as large, touch-friendly (min 44×44px) primary CTAs

## 7. Admin Page — Logo Upload

- [x] 7.1 Add logo section to `public/admin/index.html`: current logo preview, file input, Save button
- [x] 7.2 On admin page load, fetch `GET /api/:slug/restaurant` and display current logo if set
- [x] 7.3 Implement logo upload submit: POST multipart form to `PUT /api/:slug/restaurant`; refresh preview on success
- [x] 7.4 Add "Server View" navigation button to admin page header; `target="_blank"` to `/{slug}/server`

## 8. Server Page — Category Filters & Navigation

- [x] 8.1 Extract distinct `beverage_type` values from `allEntries` after load
- [x] 8.2 Render filter chip row above results: "All" chip + one chip per distinct type
- [x] 8.3 Implement chip selection logic: radio behavior, update active chip styling
- [x] 8.4 Integrate category filter into `renderResults` filtering (AND with existing rack + name filters)
- [x] 8.5 Add "Admin" navigation button to server page header; `target="_blank"` to `/{slug}/de`

## 9. Admin Page — Menu Items Management

- [x] 9.1 Add "Menu" section to `public/admin/index.html` with item list and Add form (name, description, category, sort_order)
- [x] 9.2 On admin load, fetch `GET /api/:slug/menu-items` and render list
- [x] 9.3 Implement Add: POST to `/api/:slug/menu-items`; refresh list on success
- [x] 9.4 Implement Edit: inline edit or modal pre-populated with item fields; PUT on save
- [x] 9.5 Implement Delete: confirm prompt; DELETE request; remove item from list

## 10. Admin Page — Pairing Management

- [x] 10.1 Add pairing sub-panel that appears when a menu item is selected in the Menu section
- [x] 10.2 On item select, fetch `GET /api/:slug/menu-items/:id/pairings` and display paired beverages
- [x] 10.3 Add beverage search (reuse/adapt existing combo box) to find wine list entries to pair
- [x] 10.4 Implement Add Pairing: POST to `/:id/pairings`; refresh pairing list; handle 409 duplicate gracefully
- [x] 10.5 Implement Remove Pairing: DELETE request; remove entry from pairing list

## 11. Cuisine Server Page

- [x] 11.1 Create `public/cuisine/index.html` with dark theme, header (title + Admin nav button), and main content area
- [x] 11.2 On load, fetch `GET /api/:slug/menu-items`; group by category and render grouped list
- [x] 11.3 Implement menu item tap: fetch `GET /api/:slug/menu-items/:id/pairings`; render paired beverages list
- [x] 11.4 Show empty state if no menu items exist; show per-item empty state if item has no pairings
- [x] 11.5 Add "back to menu" affordance from the pairings view to the menu item list
- [x] 11.6 Copy detail modal markup and logic from `public/server/index.html`; wire up to beverage tap
- [x] 11.7 Add "Admin" navigation button to cuisine page header; `target="_blank"` to `/{slug}/de`
