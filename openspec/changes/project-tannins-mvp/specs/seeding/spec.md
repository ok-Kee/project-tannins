## ADDED Requirements

### Requirement: Excel import script populates beverages and wine_list
A one-time Node.js seed script SHALL parse the Tannins Bar Wine 2026.xlsx file and insert records into `beverages` (master list) and `wine_list` (restaurant records). The script SHALL derive wine type from section header rows (e.g., "BTG White" → type = "White"). The script SHALL be re-runnable (idempotent — skip existing beverages by name).

#### Scenario: Section headers map to wine type
- **WHEN** the import script encounters a row like "BTG White" or "List Reds"
- **THEN** subsequent wine rows are assigned the corresponding type (White or Red)

#### Scenario: BTG prices are set from BTG column
- **WHEN** the import script processes a BTG section row with a BTG price
- **THEN** `price_btg` is populated; `price_btl` is set to null unless also present

#### Scenario: List-only prices are set from BTL column
- **WHEN** the import script processes a list-only row with only a BTL price
- **THEN** `price_btl` is populated; `price_btg` is set to null

#### Scenario: Duplicate beverage names are skipped
- **WHEN** the import script runs a second time and a beverage name already exists in `beverages`
- **THEN** no duplicate record is created; the existing record is used

#### Scenario: Unparseable rows are logged and skipped
- **WHEN** the import encounters a row that cannot be mapped to a beverage
- **THEN** the row is logged with a warning and skipped; the script continues

### Requirement: LLM enrichment script populates general_pairing via Claude API
A second Node.js script SHALL iterate all `beverages` records where `general_pairing` is null or empty, call the Claude API (claude-sonnet-4-6) with the beverage name and type as context, and write the response back to `beverages.general_pairing`. The script SHALL be rate-limited to avoid API quota errors.

#### Scenario: General pairing generated for empty record
- **WHEN** the enrichment script finds a beverage with no general_pairing
- **THEN** it calls the Claude API and stores the food pairing recommendations in `beverages.general_pairing`

#### Scenario: Already-enriched records are skipped
- **WHEN** the enrichment script finds a beverage with an existing general_pairing
- **THEN** no API call is made for that record

#### Scenario: API error is logged and script continues
- **WHEN** the Claude API call fails for a specific beverage
- **THEN** the error is logged, the beverage is skipped, and the script continues with the next record

### Requirement: Seeding pipeline runs in two explicit steps
The seeding process SHALL be documented and runnable as two sequential npm scripts: (1) `npm run seed:import` and (2) `npm run seed:enrich`. Both SHALL be idempotent and safe to re-run.

#### Scenario: Import then enrich completes successfully
- **WHEN** both seed scripts are run in order against an empty database
- **THEN** all Tannins Bar wines are present in `wine_list` and all beverages have a `general_pairing` value
