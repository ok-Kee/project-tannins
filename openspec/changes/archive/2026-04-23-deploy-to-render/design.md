## Context

Project Tannins is a Node.js/Express app using SQLite for storage and Multer for image uploads. Both the database file (`./db/tannins.db`) and uploaded images (`./uploads/{slug}/`) are currently resolved relative to `__dirname`, which means they live inside the deployed container's ephemeral filesystem. On Render, containers are replaced on every deploy — any data written to the container is lost. A Render Persistent Disk mounted at `/data` survives redeploys and is the correct home for both.

PORT binding already reads `process.env.PORT`, so that requires no change.

## Goals / Non-Goals

**Goals:**
- Produce a `render.yaml` Blueprint so the service and disk are fully reproducible from the repo
- Route both the SQLite DB and uploads directory to the persistent disk mount in production
- Keep local dev working without any changes (paths fall back to current locations)
- Document which env vars to set in the Render dashboard

**Non-Goals:**
- Migrating away from SQLite (fine for this traffic level)
- Setting up CI/CD beyond Render's built-in GitHub auto-deploy
- HTTPS / custom domain (Render provides a `.onrender.com` URL with TLS out of the box)
- Automating the initial seed — first-run seeding is a manual one-off job

## Decisions

**1. Single `DATA_DIR` env var controls the persistent disk root**

Both the DB path and uploads directory are derived from one env var: `DATA_DIR`. In production, Render sets `DATA_DIR=/data`. Locally, it is unset and both paths fall back to their existing locations (`./db/tannins.db` and `./uploads/`).

- `DB_PATH` becomes `${DATA_DIR}/tannins.db` when `DATA_DIR` is set, otherwise `./db/tannins.db`
- Uploads destination becomes `${DATA_DIR}/uploads/{slug}/` when `DATA_DIR` is set, otherwise `./uploads/{slug}/`

This avoids threading multiple env vars through the codebase and keeps the fallback simple.

Alternative considered: keep `DB_PATH` as a standalone env var (already exists in `.env.example`). Rejected because it would require setting two vars on Render and doesn't handle the uploads path.

**2. Persistent disk mounted at `/data`, 10 GB**

Render's minimum disk size is 1 GB. 10 GB gives plenty of headroom for SQLite growth and bottle/label images across multiple restaurants without requiring a resize for the foreseeable future. The disk is attached to the web service (not a separate job), so both the app and any one-off jobs share the same mount.

**3. `render.yaml` Blueprint for reproducibility**

Defining the service in `render.yaml` means the Render environment is version-controlled and can be recreated from scratch. It also makes it easy to add a second restaurant's service later by duplicating the config block.

**4. Uploads static serving path updated alongside upload destination**

`app.js` currently serves `/uploads` from `__dirname/../uploads`. This must be updated to serve from `DATA_DIR/uploads` (or the fallback) so uploaded images resolve correctly at their public URL after being written to the disk mount.

## Risks / Trade-offs

- **SQLite on a single Render instance**: SQLite doesn't support multiple concurrent writers, but this app is single-instance so there's no conflict. If the app ever scales to multiple instances, a proper database (Postgres, which Render also offers) would be required. → Acceptable for MVP.
- **Disk is tied to one region**: Render persistent disks can't be replicated across regions. If the region goes down, the data is unavailable. → Acceptable for MVP; a SQLite backup cron job (e.g., nightly copy to S3) is a sensible follow-up.
- **Initial deploy requires manual seeding**: The DB on the new disk starts empty. After first deploy, the operator runs `seed:import` and `seed:enrich` as Render one-off jobs. → Document clearly in deploy steps.

## Migration Plan

1. Merge code changes (DATA_DIR wiring + render.yaml) to `main`
2. Connect the GitHub repo to a new Render Web Service via the Blueprint
3. Set env vars in the Render dashboard: `DATA_DIR=/data`, `ANTHROPIC_API_KEY`, `TANNINS_BAR_PASS`
4. Trigger a deploy; confirm the app starts and the `/data` disk is mounted
5. Run `npm run seed:import` as a Render one-off job (upload the Excel file to the repo or fetch from disk)
6. Run `npm run seed:enrich` as a Render one-off job
7. Smoke-test the live URL

Rollback: Render retains the previous deploy and can roll back in one click. The persistent disk is unaffected by rollbacks.

## Open Questions

- Should the Excel file for seeding be committed to the repo so it's available inside the Render environment for one-off jobs, or uploaded separately? (Currently it lives in the project root but is not gitignored.)
