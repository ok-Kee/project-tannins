# Project Tannins — Easily Paired

Multi-tenant wine-pairing PWA for restaurant servers. Product brand: **Easily Paired**;
company: **Pairz LLC**. Node/Express + SQLite (`better-sqlite3`, WAL), vanilla-JS
frontend with **no build step**, deployed to Render.

## Where the docs live
- [`README.md`](README.md) — setup, env vars, schema table, API overview, local run.
- [`docs/architecture.md`](docs/architecture.md) — stack, multi-tenancy model, pages, theming, high-contrast.
- [`docs/data-model.md`](docs/data-model.md) — tables and the shared-vs-override field model.
- [`docs/runbook.md`](docs/runbook.md) — deploy, tenant provisioning, seeding, gotchas.

Read the relevant `docs/` file before changing that area, and **update it in the same
change**. These docs replace the old `openspec/` workflow — they are only useful if kept
current, so treat updating them as part of the change, not a follow-up.

## Conventions & gotchas (read before editing)
- **No build step.** Frontend is vanilla-JS ES modules in `public/`; edit and ship. No bundler, no framework.
- **Push-to-prod.** Render deploys on push to `main` (Blueprint auto-syncs `render.yaml`). There is no preview environment — branch for review if a change is risky.
- **DB migrations run on boot.** `render.yaml` startCommand is `node scripts/db-init.js && node src/app.js`. `db-init.js` is idempotent (CREATE IF NOT EXISTS + guarded ALTERs) — add new columns there.
- **DB path resolution.** The app and newer scripts resolve `DB_PATH || DATA_DIR/tannins.db || ./db/tannins.db`; on Render `DATA_DIR=/data`. The older `seed-import.js` / `seed-enrich.js` honor **only** `DB_PATH` — pass `DB_PATH=/data/tannins.db` when running those on Render.
- **Shared vs. override fields.** `beverages` is a global catalog shared across tenants and AI-seeded (`general_pairing`, `flavor_profile`); each restaurant's `wine_list` row can override with `house_pairing` / `house_flavor_profile`. Guest pages display `house_x || x`. See `docs/data-model.md`.
- **Local dev caveat.** `better-sqlite3` v11 won't compile on Node 26 — use Node 22 LTS locally. (Render's build is unaffected.)
