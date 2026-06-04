## ADDED Requirements

### Requirement: menu_items table stores per-restaurant food dishes
A `menu_items` table SHALL exist with columns: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `restaurant_id INTEGER NOT NULL REFERENCES restaurants(id)`, `name TEXT NOT NULL`, `description TEXT`, `category TEXT`, `sort_order INTEGER DEFAULT 0`.

#### Scenario: Table created by db-init
- **WHEN** `npm run db:init` is run
- **THEN** the `menu_items` table exists with all specified columns

### Requirement: API supports CRUD for menu items
The following routes SHALL be available, all scoped to `/:slug`:

- `GET /api/:slug/menu-items` — returns all menu items for the restaurant, ordered by `sort_order ASC, name ASC`
- `POST /api/:slug/menu-items` — creates a new menu item (auth-gated)
- `PUT /api/:slug/menu-items/:id` — updates an existing menu item (auth-gated)
- `DELETE /api/:slug/menu-items/:id` — deletes a menu item and its pairings (auth-gated)

#### Scenario: List menu items
- **WHEN** `GET /api/:slug/menu-items` is called
- **THEN** all menu items for the restaurant are returned as JSON, ordered by sort_order then name

#### Scenario: Create menu item
- **WHEN** an authenticated `POST /api/:slug/menu-items` is sent with `{ name, description, category, sort_order }`
- **THEN** a new record is inserted and the response contains `{ id }`

#### Scenario: Create requires name
- **WHEN** a `POST /api/:slug/menu-items` is sent without a `name` field
- **THEN** the server returns 400

#### Scenario: Update menu item
- **WHEN** an authenticated `PUT /api/:slug/menu-items/:id` is sent with updated fields
- **THEN** the record is updated and the server returns 200

#### Scenario: Delete menu item
- **WHEN** an authenticated `DELETE /api/:slug/menu-items/:id` is sent
- **THEN** the menu item and all its pairings are deleted and the server returns 200

#### Scenario: Unauthenticated mutation rejected
- **WHEN** a POST, PUT, or DELETE is sent to a menu-items route without credentials
- **THEN** the server returns 401

### Requirement: Admin page provides menu item management UI
The admin page SHALL include a "Menu" section with a list of existing menu items and controls to add, edit, and delete them. Each item SHALL display its name, category, and description.

#### Scenario: Menu section shows existing items
- **WHEN** the admin page loads
- **THEN** all menu items for the restaurant are listed in the Menu section

#### Scenario: Admin adds a new menu item
- **WHEN** admin fills in the name, optional description, optional category, and clicks Add
- **THEN** the item is created via the API and appears in the list

#### Scenario: Admin edits a menu item
- **WHEN** admin selects a menu item and updates its fields
- **THEN** the updated values are saved via the API

#### Scenario: Admin deletes a menu item
- **WHEN** admin clicks the delete control on a menu item and confirms
- **THEN** the item and its pairings are removed via the API and the list updates
