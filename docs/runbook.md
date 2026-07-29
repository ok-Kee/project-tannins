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
| `seed:import` | import wines from an Excel sheet (Tannins Bar layout) | **`DB_PATH` only** |
| `seed:import:mps` | import Mountain Prime wines (thin variant of `seed:import`) | **`DB_PATH` only** |
| `seed:menu` | import food menu from a `[Category,Item,Description,Size,Price]` CSV | honors `DATA_DIR` |
| `seed:beverages` | import non-wine beverages from a `[name,type,price]` CSV | honors `DATA_DIR` |
| `seed:flavor` | AI-fill `beverages.flavor_profile` where null | honors `DATA_DIR` |
| `seed:pairings` | AI-fill `menu_item_pairings` (per-tenant menu pairings + per-pairing note) | honors `DATA_DIR` |

> `seed:enrich` (AI-fill `beverages.general_pairing`) is **retired** — generic per-beverage
> pairing copy is superseded by real menu pairings (`seed:pairings`). The script file
> remains but is no longer wired to an npm task and should not be run.

All three MP importers are **insert-only + idempotent** (skip a wine/dish already present for
that tenant) and scoped to a single tenant slug, so re-running is safe and applying them to
prod is **additive** — it creates only the Mountain Prime tenant and never touches
`tannins-bar`. No whole-DB swap.

- Run AI seeds **after** a data load so one pass covers all wines. Both AI seeds are
  incremental (skip already-filled rows) and safe to re-run.
- ⚠️ **`seed-import.js` / `seed-import-mps.js` ignore `DATA_DIR`.** On Render, run them as
  `DB_PATH=/data/tannins.db npm run seed:import:mps` or they write to an ephemeral
  `./db/tannins.db`. `seed-import.js` (and its MP variant `seed-import-mps.js`) are hardcoded
  to a spreadsheet shape (slug, sheet name, section parsing). `seed-menu.js` /
  `seed-beverages-csv.js` honor `DATA_DIR`, but on Render still pass `DB_PATH=/data/tannins.db`
  explicitly to be safe.

## Mountain Prime data load (Phase 1)
First client. Source files are committed under `data/mountain-prime/`
(`mps-wine.xlsx`, `mps-menu.csv`, `mps-nonwine-beverages.csv` — low-sensitivity public data,
committed deliberately so the deployed container can read them). The wine list stays as `.xlsx`
because its section-header rows (`BTG Red`, `List Whites`, …) drive the type/BTG parser; the
menu and non-wine lists are flat tabular data, kept as diff-able CSV. The non-wine CSV was
structured once by hand from `MPS Beverage lists.odt` (its wine section is ignored — the wine
xlsx wins on any price/item drift); its price lands in "By the Glass" for drafts/ports/
cocktails and "Per Bottle" for bottled/canned items.

Local (Node 22, default `./db/tannins.db`):
```bash
npm run db:init
MOUNTAIN_PRIME_PASS='<pw>' npm run seed:import:mps   # creates the tenant + wines
npm run seed:menu                                    # 35 dishes
npm run seed:beverages                               # non-wine beverages
```

Prod (Render shell), **additive** — back up first, confirm the live slug matches:
```bash
cp /data/tannins.db /data/tannins.db.bak.$(date +%s)
sqlite3 /data/tannins.db 'SELECT id,slug,name FROM restaurants;'   # confirm slug = mountain-prime
DB_PATH=/data/tannins.db MOUNTAIN_PRIME_PASS='<pw>' npm run seed:import:mps
DB_PATH=/data/tannins.db npm run seed:menu
DB_PATH=/data/tannins.db npm run seed:beverages
```
Then smoke-test `/mountain-prime/server` + `/mountain-prime/cuisine` and confirm `tannins-bar`
is unchanged. Pairings / flavor profiles stay empty until Phase 2 (AI passes) — expected
interim state.

## Mountain Prime AI passes (Phase 2)
Two idempotent AI passes, run after the Phase 1 load. Both fill only empty rows, so re-runs
are safe. Requires `ANTHROPIC_API_KEY`.

- **`seed:flavor`** — fills `beverages.flavor_profile` (shared catalog; one pass covers all).
- **`seed:pairings`** — beverage-centric menu pairings. For each eligible beverage on the
  tenant's list (all types **except `N/A`** — sodas/juices/N-A drinks are skipped) the model
  picks its best 2–4 dishes and writes a per-pairing note into
  `menu_item_pairings.ai_pairing_text`. Scoped to `RESTAURANT_SLUG` (default `mountain-prime`);
  skips any beverage that already has pairings. Restaurants curate the wording per entry via
  `house_pairing_text` in admin (display = `house_pairing_text || ai_pairing_text`).

Local (Node 22):
```bash
npm run seed:flavor
npm run seed:pairings          # RESTAURANT_SLUG=mountain-prime by default
```

Prod (Render shell), **additive** — back up first; scoped to the tenant, never touches
`tannins-bar`. `db-init` on the next boot adds the `ai_pairing_text`/`house_pairing_text`
columns automatically:
```bash
cp /data/tannins.db /data/tannins.db.bak.$(date +%s)
DB_PATH=/data/tannins.db npm run seed:flavor
DB_PATH=/data/tannins.db npm run seed:pairings
```
Prod generation is a fresh run (LLM output differs from local); the local pass validates the
prompt + UI quality, and MP finalizes wording in admin. `seed:enrich` / `general_pairing` are
retired — do not run enrich.

## Known gotchas
- **Local `better-sqlite3` won't build on Node 26** (V8 API removed). Use Node 22 LTS locally;
  Render's build is unaffected.
- **New API code that queries a not-yet-added column** will 500 until the migration runs — the
  boot migration (above) covers this on deploy, but running new code against an un-migrated DB
  by hand will fail. `GET /api/:slug/wine-list` uses `SELECT wl.*, b.<explicit cols>`, so
  `wine_list` columns flow through automatically but new `beverages` columns must be added to
  the SELECT.

## Current state
- Tenants: `tannins-bar` (original), `mountain-prime` (first client; Phase 1 data load **done**
  — 86 wines, 35 menu items, 47 non-wine beverages loaded to prod `/data`. Display name on prod
  is "Mountain Prime Steakhouse & Lounge"). Phase 2 AI passes (`seed:flavor` +
  `seed:pairings`) built + run locally; menu pairings carry per-pairing notes editable in
  admin. Prod run pending.
- Product brand **Easily Paired**, company **Pariz LLC**.
