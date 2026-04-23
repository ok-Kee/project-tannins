## Why

Project Tannins is running locally and needs to be accessible to restaurant staff on the floor from any device. Deploying to Render gives Tannins Bar a live URL with minimal ops overhead, no infrastructure to manage, and a persistent disk to keep the SQLite database and uploads intact across deploys.

## What Changes

- Add a `render.yaml` Blueprint file to define the web service and persistent disk declaratively
- Update `DB_PATH` and uploads path handling to use a configurable mount point so both the database and uploaded images survive deploys
- Ensure the Express server binds to `process.env.PORT` (Render assigns the port dynamically)
- Document required environment variables for the Render dashboard
- Verify seed and enrich scripts can be run as Render one-off jobs

## Capabilities

### New Capabilities
- `render-deployment`: Render web service configuration, persistent disk mount for DB and uploads, environment variable wiring, and one-off job support for seeding

### Modified Capabilities

## Impact

- `src/app.js`: confirm PORT binding uses `process.env.PORT`
- `src/app.js` / upload config: uploads directory must resolve relative to disk mount path, not `__dirname`
- `db/` and `uploads/`: both relocated to persistent disk mount (e.g. `/data`) in production; local paths unchanged for dev
- New file: `render.yaml`
- Env vars added to Render dashboard: `DB_PATH`, `ANTHROPIC_API_KEY`, `TANNINS_BAR_PASS`
