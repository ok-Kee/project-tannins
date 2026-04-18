## Context

Project Tannins is a greenfield PWA for restaurant wine list management. The first tenant is Tannins Bar, with ~80 wines across BTG, list-only, bubbles, dessert categories. The app has two distinct user types: admins (restaurant staff managing data) and servers (front-of-house looking up pairings). There is no existing codebase.

## Goals / Non-Goals

**Goals:**
- Tablet-optimized, mobile-friendly PWA
- Multi-tenant from day one (slug-based isolation)
- Phase 1: Admin CRUD for wine list entries with image upload
- Phase 2: Server read-only lookup with rack/name search and detail modal
- One-time seeding pipeline: Excel → SQLite + Claude API for general pairings
- Single-command startup (`npm start`)

**Non-Goals:**
- Multi-restaurant self-serve onboarding (manual DB seed for now)
- Offline PWA caching (service worker deferred post-MVP)
- JWT/OAuth (Basic Auth sufficient for MVP scale)
- Full rack management UI (seed script is fine for MVP)
- Wine rating field (not in schema; present in example doc but excluded from app)

## Decisions

### Backend: Node.js + Express over Python/FastAPI
Express has better ecosystem fit for serving a PWA static bundle from the same process, and `better-sqlite3` is synchronous/fast for SQLite. FastAPI would need a separate static server. Node was chosen for simpler single-process deployment.

### Database: SQLite with `better-sqlite3`
Local file; zero infra. Schema is designed with `restaurant_id` FK on all tenant tables so migrating to Postgres later is a column rename away. `better-sqlite3` is synchronous — no async complexity for simple CRUD.

### Auth: HTTP Basic Auth per restaurant
Each restaurant has one credential pair stored as `http_user` / `http_pass_hash` (bcrypt) in the `restaurants` table. Express middleware checks the Authorization header on all `/de` routes. Phase 2 server view has no auth (URL obscurity for MVP).

### Image Storage: Local filesystem under `/uploads/{slug}/`
Multer handles multipart uploads. Images are served as static files. S3/R2 is the obvious migration path; the `label_image_path` / `bottle_image_path` columns store relative paths so the storage layer is swappable.

### Frontend: Vanilla JS PWA (no framework)
Tablet-first, no build step needed for MVP. Framework can be added later. Manifest + HTTPS (or localhost) enables PWA installation on tablets.

### LLM Enrichment: Claude API (claude-sonnet-4-6) via seeding script
A one-time Node.js script reads beverages with empty `general_pairing`, calls Claude with beverage name + type, and writes results back. Not triggered in real-time for MVP — runs at seed time and can be re-run for additions.

### URL Structure
```
/waitingfortips/{slug}/de      → Admin entry (Basic Auth protected)
/waitingfortips/{slug}/server  → Server lookup (no auth)
/waitingfortips/{slug}/setup   → Rack setup (Basic Auth, MVP seed only)
```

### Data Seeding: Two-pass pipeline
1. Parse Excel (Tannins Bar Wine 2026.xlsx) → populate `beverages` + `wine_list`
2. Claude API enrichment pass → populate `general_pairing` for all beverages

The Excel has category headers as section dividers (BTG Bubbles & Pink, BTG White, BTG Red, List Pink & Orange, List Bubbles, List Whites, List Reds, Desserts). The import script derives `type` from these section headers and sets `price_btg`/`price_btl` accordingly.

## Risks / Trade-offs

- **SQLite concurrent writes** → Mitigation: Single-tenant MVP, WAL mode enabled; acceptable for low-concurrency restaurant use
- **No auth on server view** → Mitigation: URL is a shared secret for MVP; PIN auth planned for Phase 3
- **Image storage on local disk** → Mitigation: Acceptable for single-server MVP; document migration path to S3
- **Basic Auth over HTTP (dev)** → Mitigation: Document that HTTPS is required for production; localhost dev is fine
- **Excel import fragility** → Mitigation: Write import script defensively; log skipped/unparseable rows; keep source file for re-runs

## Open Questions

- Should rack numbers be auto-assigned from Excel data or entered manually in Phase 1? (Current plan: manual seed via setup script or direct DB entry)
- Wine rating field appears in the example doc but is not in the schema — confirm exclusion from MVP data model
