## 1. Project Setup & Infrastructure

- [x] 1.1 Initialize Node.js project with package.json, install dependencies (express, better-sqlite3, bcrypt, multer, dotenv, @anthropic-ai/sdk, xlsx)
- [x] 1.2 Create directory structure: `/src`, `/public`, `/uploads`, `/scripts`, `/db`
- [x] 1.3 Set up SQLite database initialization script with all schema tables (restaurants, racks, beverages, wine_list)
- [x] 1.4 Configure Express app with static file serving, JSON middleware, and uploads directory
- [x] 1.5 Add npm scripts: `start`, `seed:import`, `seed:enrich`, `db:init`
- [x] 1.6 Create `.env.example` with required env vars (ANTHROPIC_API_KEY, DB_PATH, PORT)
- [x] 1.7 Add PWA manifest.json and basic service worker stub to `/public`

## 2. Database Schema

- [x] 2.1 Create `restaurants` table (id, slug UNIQUE, name, http_user, http_pass_hash)
- [x] 2.2 Create `racks` table (id, restaurant_id FK, rack_number TEXT)
- [x] 2.3 Create `beverages` table (id, name TEXT, type TEXT, general_pairing TEXT)
- [x] 2.4 Create `wine_list` table (id, restaurant_id FK, rack_id FK nullable, beverage_id FK, sommelier_comments, house_pairing, snack_notes, price_btl DECIMAL, price_btg DECIMAL, label_image_path, bottle_image_path, created_at, updated_at)
- [x] 2.5 Enable WAL mode on SQLite connection

## 3. Auth Middleware

- [x] 3.1 Implement `basicAuth` Express middleware that parses Authorization header and bcrypt-verifies against restaurants table by slug
- [x] 3.2 Apply middleware to all `/waitingfortips/:slug/de` and `/waitingfortips/:slug/setup` routes
- [x] 3.3 Return 401 + WWW-Authenticate header for missing or invalid credentials

## 4. API Routes — Restaurants & Racks

- [x] 4.1 `GET /api/:slug/racks` — return rack list for restaurant (auth required)
- [x] 4.2 `POST /api/:slug/racks` — create a rack (auth required, setup use)

## 5. API Routes — Beverages

- [x] 5.1 `GET /api/beverages?q=` — search beverages by name (substring, case-insensitive); return id, name, type, general_pairing
- [x] 5.2 `POST /api/beverages` — create new beverage (used by import script; auth not required for script use)

## 6. API Routes — Wine List

- [x] 6.1 `GET /api/:slug/wine-list` — return all wine list entries for restaurant, joined with beverage name and rack number
- [x] 6.2 `GET /api/:slug/wine-list/:id` — return single wine list entry with all fields
- [x] 6.3 `POST /api/:slug/wine-list` — create new entry (auth required); handle multipart with Multer for image uploads
- [x] 6.4 `PUT /api/:slug/wine-list/:id` — update existing entry (auth required); handle image re-upload
- [x] 6.5 Configure Multer: store to `/uploads/{slug}/`, accept JPG/PNG only, 10MB limit, reject other types with 400

## 7. Seeding — Excel Import

- [x] 7.1 Write `scripts/seed-import.js` that reads Tannins Bar Wine 2026.xlsx using the `xlsx` package
- [x] 7.2 Parse section header rows (BTG Bubbles & Pink, BTG White, BTG Red, List Pink & Orange, List Bubbles, List Whites, List Reds, Desserts) to derive wine type for subsequent rows
- [x] 7.3 Insert each wine row into `beverages` (skip if name already exists) and create corresponding `wine_list` record under Tannins Bar restaurant
- [x] 7.4 Map BTG price to `price_btg`, BTL price to `price_btl` based on which column has a value
- [x] 7.5 Log skipped/unparseable rows with a warning; exit 0 on completion
- [x] 7.6 Ensure script creates the Tannins Bar restaurant record if it does not exist (slug: `tannins-bar`, default password from env)

## 8. Seeding — LLM Enrichment

- [x] 8.1 Write `scripts/seed-enrich.js` that fetches all beverages with null/empty `general_pairing`
- [x] 8.2 For each beverage, call Claude API (claude-sonnet-4-6) with prompt: beverage name + type → food pairing recommendations
- [x] 8.3 Write response to `beverages.general_pairing`; include prompt caching headers for efficiency
- [x] 8.4 Rate-limit calls (100ms delay between requests); log progress and any API errors
- [x] 8.5 Skip already-enriched records; re-runnable safely

## 9. Phase 1 — Admin Entry UI

- [x] 9.1 Create `public/admin/index.html` — tablet-optimized layout with form and entry list
- [x] 9.2 Implement rack # dropdown that fetches from `GET /api/:slug/racks`
- [x] 9.3 Implement beverage combo box with debounced search-as-you-type calling `GET /api/beverages?q=`
- [x] 9.4 Auto-populate General Pairing textarea (read-only) when beverage is selected
- [x] 9.5 Implement type checkboxes: White, Red, Rosé, Champagne, Sparkling Wine, Beer, Cocktail, Mocktail, Soda
- [x] 9.6 Implement all remaining form fields: Sommelier Comments, House Pairing, Price BTL/BTG, Label image, Bottle image, Snack
- [x] 9.7 On Save: POST to `/api/:slug/wine-list` (new) or PUT to `/api/:slug/wine-list/:id` (edit) with FormData
- [x] 9.8 Render wine list table below form; clicking a row populates form for editing
- [x] 9.9 Serve admin UI at `/waitingfortips/:slug/de` (Express route serving the HTML, auth middleware applied)

## 10. Phase 2 — Server Lookup UI

- [x] 10.1 Create `public/server/index.html` — tablet-optimized, read-only lookup interface
- [x] 10.2 Implement rack # dropdown (fetches same racks API, no auth needed — move GET racks to public or create public variant)
- [x] 10.3 Implement beverage name search combo box with debounced type-ahead
- [x] 10.4 Display search results as a list of wine entries (beverage name, rack, type)
- [x] 10.5 On entry tap/click: open detail modal showing all fields (Sommelier Comments, General Pairing, House Pairing, Price BTL/BTG, Label image, Bottle image, Snack notes)
- [x] 10.6 Implement Close button to dismiss modal and return to search
- [x] 10.7 Ensure all touch targets are ≥44x44px; test on 1024x768 viewport
- [x] 10.8 Serve server UI at `/waitingfortips/:slug/server` (no auth middleware)

## 11. Integration & Testing

- [x] 11.1 Verify full seeding pipeline: `npm run db:init && npm run seed:import && npm run seed:enrich`
- [x] 11.2 Smoke test admin entry: create a new wine list entry with image upload, verify in DB
- [x] 11.3 Smoke test admin edit: load existing entry, modify fields, save, verify updated_at changes
- [ ] 11.4 Smoke test server lookup: search by rack, search by name, open detail modal, close
- [x] 11.5 Verify auth: unauthenticated request to `/de` returns 401; server route returns 200 without auth
- [x] 11.6 Verify data isolation: confirm queries filter by restaurant_id
- [x] 11.7 Test image upload: valid JPG accepted; non-image file rejected with 400
