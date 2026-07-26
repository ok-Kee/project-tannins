# Runbook

## Deployment (Render)
- Defined by `render.yaml` (a Render **Blueprint** — changes to it auto-sync on push).
- **Push to `main` deploys to production.** No preview environment exists; branch first for
  risky changes and merge when ready.
- `startCommand: node scripts/db-init.js && node src/app.js` — the idempotent migration runs
  on every boot *before* the app serves, so new columns/migrations apply automatically on
  deploy. Nothing to run by hand for a schema change.
- Persistent disk mounts at `/data` (`DATA_DIR=/data`); both `tannins.db` and `uploads/` live
  there. Secrets set in the Render dashboard: `ANTHROPIC_API_KEY`, `TANNINS_BAR_PASS` (and a
  per-tenant password env for each new tenant if you wire one).

## Provisioning a new tenant
No create-restaurant API exists. In a **Render shell**, with the code deployed:

```bash
TENANT_PASS='<pick-a-password>' node scripts/create-tenant.js <slug> "<Display Name>"
```

- Auto-resolves to `/data/tannins.db` (honors `DATA_DIR`); idempotent on an existing slug.
- Afterward: `/<slug>` is live, admin at `/<slug>/de` (user `admin`, the password you set).
  Logo + theme + data are added from the admin panel / import.

## Data load & AI seeding
Scripts (`npm run <name>`):

| Script | Purpose | DB path |
|---|---|---|
| `db:init` | create/migrate schema (idempotent; also runs on boot) | honors `DATA_DIR` |
| `create:tenant` | insert a tenant row | honors `DATA_DIR` |
| `seed:import` | import wines from an Excel sheet | **`DB_PATH` only** |
| `seed:enrich` | AI-fill `beverages.general_pairing` where null | **`DB_PATH` only** |
| `seed:flavor` | AI-fill `beverages.flavor_profile` where null | honors `DATA_DIR` |

- Run AI seeds **after** a data load so one pass covers all wines. Both AI seeds are
  incremental (skip already-filled rows) and safe to re-run.
- ⚠️ **`seed-import.js` / `seed-enrich.js` ignore `DATA_DIR`.** On Render, run them as
  `DB_PATH=/data/tannins.db npm run seed:import` or they write to an ephemeral
  `./db/tannins.db`. `seed-import.js` is also currently hardcoded to Tannins' spreadsheet
  shape (slug, sheet name, section parsing) and imports wines only — no menu/food importer
  exists yet.

## Known gotchas
- **Local `better-sqlite3` won't build on Node 26** (V8 API removed). Use Node 22 LTS locally;
  Render's build is unaffected.
- **New API code that queries a not-yet-added column** will 500 until the migration runs — the
  boot migration (above) covers this on deploy, but running new code against an un-migrated DB
  by hand will fail. `GET /api/:slug/wine-list` uses `SELECT wl.*, b.<explicit cols>`, so
  `wine_list` columns flow through automatically but new `beverages` columns must be added to
  the SELECT.

## Current state
- Tenants: `tannins-bar` (original), `mountain-prime` (first client, live; wine/menu data load
  pending).
- Product brand **Easily Paired**, company **Pariz LLC**.
