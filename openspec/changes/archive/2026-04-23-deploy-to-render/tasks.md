## 1. Data directory path wiring

- [x] 1.1 Add `DATA_DIR` support to `src/app.js`: derive uploads static path from `DATA_DIR` when set, falling back to `./uploads`
- [x] 1.2 Add `DATA_DIR` support to `src/routes/wineList.js`: derive upload destination directory from `DATA_DIR` when set, falling back to `./uploads`
- [x] 1.3 Update `src/db.js` (or wherever `DB_PATH` is resolved): derive default DB path from `DATA_DIR` when set (`${DATA_DIR}/tannins.db`), falling back to `./db/tannins.db`
- [x] 1.4 Update `.env.example` to document `DATA_DIR` (leave blank for local dev, set to `/data` on Render)

## 2. Render Blueprint

- [x] 2.1 Create `render.yaml` defining the web service (build command `npm install`, start command `node src/app.js`, Node runtime)
- [x] 2.2 Add persistent disk to `render.yaml` (mount path `/data`, size 10 GB)
- [x] 2.3 List all required env vars in `render.yaml` as `envVars` entries (sync vars with values, secret vars as `sync: false`)

## 3. Verification

- [x] 3.1 Confirm app starts locally with `DATA_DIR` set to a temp directory and DB + uploads resolve to that path
- [x] 3.2 Push to GitHub, connect repo to Render via Blueprint, and confirm service starts with disk mounted
- [x] 3.3 Set env vars in Render dashboard (`DATA_DIR=/data`, `ANTHROPIC_API_KEY`, `TANNINS_BAR_PASS`)
- [x] 3.4 SCP the local `db/tannins.db` to the Render service at `/data/tannins.db` via the Render shell
- [x] 3.6 Smoke-test the live `.onrender.com` URL: server lookup, admin login, image upload
