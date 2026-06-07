## Why

The wine detail form in the admin has no visibility into which menu items a wine is paired with — even pairings created from the menu item side are invisible when viewing a wine. Admins need to see and manage menu item pairings directly from the wine detail form so the relationship is navigable from either direction.

## What Changes

- Add a **Menu Pairings** section to the wine detail form in the admin Wine tab, showing all menu items currently linked to this wine via `menu_item_pairings`
- Allow adding new pairings from the wine side by searching the menu item list and selecting a dish
- Allow removing pairings from the wine side
- Add three new API endpoints on the wine-list route to read/add/remove menu item pairings for a given wine list entry
- Pairings created or removed from either side affect the same `menu_item_pairings` join table row, so they are immediately reflected on both the wine and menu item views

## Capabilities

### New Capabilities
- `wine-menu-pairings`: Wine detail form displays all linked menu items (regardless of which side the pairing was created from), with search-and-add and remove controls; backed by new GET/POST/DELETE endpoints on the wine-list route

### Modified Capabilities

## Impact

- **`src/routes/wineList.js`** — three new endpoints: `GET /:id/pairings`, `POST /:id/pairings`, `DELETE /:id/pairings/:pairingId`
- **`public/admin/index.html`** — new Menu Pairings section in the wine form; JS to load, render, add, and remove pairings
- No schema changes — `menu_item_pairings` already supports this relationship
