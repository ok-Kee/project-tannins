## ADDED Requirements

### Requirement: menu_item_pairings table links menu items to wine list entries
A `menu_item_pairings` table SHALL exist with columns: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE`, `wine_list_id INTEGER NOT NULL REFERENCES wine_list(id) ON DELETE CASCADE`, `sort_order INTEGER DEFAULT 0`. The combination of `(menu_item_id, wine_list_id)` SHALL be unique.

#### Scenario: Table created by db-init
- **WHEN** `npm run db:init` is run
- **THEN** the `menu_item_pairings` table exists with all specified columns and the unique constraint

#### Scenario: Cascade delete on menu item removal
- **WHEN** a menu item is deleted
- **THEN** all its pairing records are also deleted

### Requirement: API supports managing pairings per menu item
The following routes SHALL be available, all scoped to `/:slug/menu-items/:id`:

- `GET /api/:slug/menu-items/:id/pairings` — returns all pairings for the menu item, with full beverage and wine list details (beverage_name, beverage_type, general_pairing, house_pairing, sommelier_comments, snack_notes, price_btg, price_btl, rack_number, label_image_path, bottle_image_path)
- `POST /api/:slug/menu-items/:id/pairings` — adds a pairing (auth-gated); body: `{ wine_list_id }`
- `DELETE /api/:slug/menu-items/:id/pairings/:pairingId` — removes a pairing (auth-gated)

#### Scenario: List pairings for a menu item
- **WHEN** `GET /api/:slug/menu-items/:id/pairings` is called
- **THEN** all pairings for that menu item are returned with full beverage details, ordered by sort_order

#### Scenario: Add a pairing
- **WHEN** an authenticated `POST /api/:slug/menu-items/:id/pairings` is sent with `{ wine_list_id }`
- **THEN** a new pairing record is inserted and the response contains `{ id }`

#### Scenario: Duplicate pairing rejected
- **WHEN** an authenticated POST attempts to add a wine_list_id that is already paired to the same menu item
- **THEN** the server returns 409

#### Scenario: Remove a pairing
- **WHEN** an authenticated `DELETE /api/:slug/menu-items/:id/pairings/:pairingId` is sent
- **THEN** the pairing record is removed and the server returns 200

#### Scenario: Unauthenticated mutation rejected
- **WHEN** a POST or DELETE is sent without credentials
- **THEN** the server returns 401

### Requirement: Admin page provides per-menu-item pairing management
When a menu item is selected in the admin Menu section, a pairing sub-panel SHALL appear allowing the admin to search the wine list and add/remove beverage pairings for that item.

#### Scenario: Pairing sub-panel shows existing pairings
- **WHEN** admin selects a menu item
- **THEN** the pairing sub-panel lists all currently paired beverages with their names and types

#### Scenario: Admin adds a beverage pairing
- **WHEN** admin searches for a beverage by name and clicks Add
- **THEN** the pairing is created via the API and appears in the sub-panel

#### Scenario: Admin removes a beverage pairing
- **WHEN** admin clicks the remove control on a pairing in the sub-panel
- **THEN** the pairing is deleted via the API and disappears from the list
