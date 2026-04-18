## Why

Restaurant servers need quick, reliable wine pairing recommendations at the table without consulting a sommelier. Project Tannins delivers a tablet-optimized PWA so servers can look up any wine on the list — with professional pairing notes — in seconds.

## What Changes

- New application from scratch (no prior codebase)
- Node.js/Express backend with SQLite database
- PWA frontend optimized for tablet use
- Admin data-entry interface for restaurant staff to manage wine lists
- Read-only server lookup interface for front-of-house use
- Multi-tenant data isolation per restaurant via URL slug
- LLM-powered (Claude API) auto-generation of general pairing notes
- One-time Excel import + enrichment seeding pipeline for Tannins Bar

## Capabilities

### New Capabilities

- `auth`: HTTP Basic Auth per restaurant — login/logout, credential storage, 401 handling
- `restaurants`: Restaurant tenant model — slug-based routing, per-tenant data isolation
- `beverages`: Master beverage list — shared across restaurants, holds LLM-generated general pairings
- `wine-list`: Per-restaurant wine list entries — rack assignment, pricing, images, sommelier notes, house pairings
- `racks`: Rack management — admin-defined rack labels per restaurant
- `admin-entry`: Phase 1 admin data-entry UI — create/edit wine list records with combo box search and file uploads
- `server-lookup`: Phase 2 server read-only UI — search by rack or beverage name, detail modal
- `seeding`: One-time data seeding pipeline — Excel import, LLM enrichment via Claude API

### Modified Capabilities

## Impact

- New project: Node.js, Express, SQLite (better-sqlite3), Anthropic SDK, Multer (file uploads)
- Frontend: Vanilla JS PWA or lightweight framework (tablet-first)
- Data: Tannins Bar wine list (111-row Excel) seeded at launch
- Auth: bcrypt for password hashing; HTTP Basic Auth middleware
- Storage: Local filesystem for uploaded images at `/uploads/{slug}/`
