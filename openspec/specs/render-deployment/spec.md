### Requirement: Render Blueprint configuration
The repository SHALL include a `render.yaml` file that fully defines the web service and persistent disk so the environment can be created from the repo without manual Render dashboard configuration beyond setting secret env vars.

#### Scenario: Blueprint defines web service
- **WHEN** a user connects the GitHub repo to Render
- **THEN** Render reads `render.yaml` and creates a web service with the correct build and start commands, region, and disk attachment

#### Scenario: Blueprint defines persistent disk
- **WHEN** the Blueprint is applied
- **THEN** Render attaches a persistent disk mounted at `/data` with at least 10 GB capacity

### Requirement: Persistent disk routing for database and uploads
The application SHALL resolve the SQLite database path and the uploads directory from a `DATA_DIR` environment variable when set, so both survive container replacement on redeploy.

#### Scenario: Production paths use DATA_DIR
- **WHEN** `DATA_DIR=/data` is set
- **THEN** the database is opened at `/data/tannins.db` and uploads are written to `/data/uploads/{slug}/`

#### Scenario: Local dev paths unchanged
- **WHEN** `DATA_DIR` is not set
- **THEN** the database path falls back to `./db/tannins.db` and uploads fall back to `./uploads/{slug}/`, preserving existing local dev behavior

#### Scenario: Uploaded images resolve at their public URL
- **WHEN** an image is uploaded and `DATA_DIR` is set
- **THEN** the image is served correctly from the `/uploads/{slug}/` public route by reading from `DATA_DIR/uploads/{slug}/`

### Requirement: Environment variable documentation
The repository SHALL document all environment variables required for a Render deployment so an operator can configure a new service without reading the source code.

#### Scenario: Operator sets up env vars
- **WHEN** an operator creates a new Render service from the Blueprint
- **THEN** they can consult the documented list to know exactly which vars to set in the Render dashboard and what values to use

### Requirement: One-off job support for seeding
The application SHALL support running `npm run seed:import` and `npm run seed:enrich` as Render one-off jobs against the live persistent disk so the database can be populated after first deploy.

#### Scenario: Seed import runs against live disk
- **WHEN** `npm run seed:import` is run as a Render one-off job with `DATA_DIR=/data`
- **THEN** the script connects to the database at `/data/tannins.db` and imports beverage data

#### Scenario: Seed enrich runs against live disk
- **WHEN** `npm run seed:enrich` is run as a Render one-off job with `DATA_DIR=/data` and `ANTHROPIC_API_KEY` set
- **THEN** the script enriches unenriched beverages in the live database
