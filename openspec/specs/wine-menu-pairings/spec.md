## ADDED Requirements

### Requirement: Wine detail form displays linked menu items
The wine detail form SHALL show a Menu Pairings section listing all menu items currently linked to the selected wine list entry via `menu_item_pairings`, regardless of which side the pairing was originally created from.

#### Scenario: Wine has existing pairings added from the menu item side
- **WHEN** an admin selects a wine entry that has pairings created via the menu item pairing panel
- **THEN** the Menu Pairings section in the wine form lists those menu items by name and category

#### Scenario: Wine has no pairings
- **WHEN** an admin selects a wine entry with no pairings
- **THEN** the Menu Pairings section shows an empty state message

#### Scenario: No wine selected
- **WHEN** no wine entry is loaded in the form
- **THEN** the Menu Pairings section is hidden

### Requirement: Admin can add a menu item pairing from the wine detail form
The wine detail form SHALL allow an authenticated admin to search the restaurant's menu items and add a pairing between the selected wine and a menu item.

#### Scenario: Successful pairing added from wine side
- **WHEN** an admin searches for a menu item by name and selects it from the dropdown
- **THEN** a row is inserted into `menu_item_pairings` and the pairing appears in the wine's Menu Pairings section

#### Scenario: Pairing also visible from menu item side
- **WHEN** a pairing is added via the wine detail form
- **THEN** navigating to that menu item's pairing panel on the Menu tab also shows the wine

#### Scenario: Duplicate pairing attempt
- **WHEN** an admin attempts to add a menu item that is already paired with the selected wine
- **THEN** a toast error is shown and no duplicate row is inserted

### Requirement: Admin can remove a menu item pairing from the wine detail form
The wine detail form SHALL allow an authenticated admin to remove an existing pairing between the selected wine and a menu item.

#### Scenario: Pairing removed from wine side
- **WHEN** an admin clicks Remove on a paired menu item in the wine's Menu Pairings section
- **THEN** the row is deleted from `menu_item_pairings` and disappears from the wine's pairing list

#### Scenario: Removal also reflected on menu item side
- **WHEN** a pairing is removed via the wine detail form
- **THEN** that wine no longer appears in the menu item's pairing panel on the Menu tab

### Requirement: Wine-list pairing API endpoints
The server SHALL expose authenticated GET, POST, and DELETE endpoints for managing menu item pairings keyed by wine list entry ID.

#### Scenario: GET returns pairings for a wine
- **WHEN** `GET /api/{slug}/wine-list/:id/pairings` is called
- **THEN** it returns an array of objects with `pairing_id`, `menu_item_id`, `name`, `category`, `description` for each linked menu item

#### Scenario: POST creates a pairing
- **WHEN** `POST /api/{slug}/wine-list/:id/pairings` is called with `{ menu_item_id }`
- **THEN** a row is inserted into `menu_item_pairings` and `201` is returned

#### Scenario: POST rejects duplicate
- **WHEN** `POST /api/{slug}/wine-list/:id/pairings` is called with a `menu_item_id` already paired to this wine
- **THEN** `409` is returned

#### Scenario: DELETE removes a pairing
- **WHEN** `DELETE /api/{slug}/wine-list/:id/pairings/:pairingId` is called
- **THEN** the row is deleted from `menu_item_pairings` and `200` is returned
