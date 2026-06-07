## 1. Backend — Wine-list pairing endpoints

- [x] 1.1 Add `GET /:id/pairings` to `src/routes/wineList.js` — queries `menu_item_pairings` joined with `menu_items`, returns `pairing_id`, `menu_item_id`, `name`, `category`, `description` for all rows matching `wine_list_id = :id` (verify wine belongs to restaurant)
- [x] 1.2 Add `POST /:id/pairings` to `src/routes/wineList.js` — accepts `{ menu_item_id }`, verifies wine and menu item belong to the restaurant, inserts into `menu_item_pairings`, returns 201; returns 409 on UNIQUE conflict
- [x] 1.3 Add `DELETE /:id/pairings/:pairingId` to `src/routes/wineList.js` — verifies the pairing's wine_list_id matches `:id` and belongs to the restaurant, deletes the row, returns 200

## 2. Frontend — Menu Pairings section in wine form

- [x] 2.1 Add a Menu Pairings section to the wine form HTML (below Snack Notes, above form actions) with a search input, combo dropdown, and pairing list container; hide the section when no entry is loaded
- [x] 2.2 Add CSS for the new section, reusing existing `.pairing-row`, `.btn-remove-pairing`, and combo styles already defined for the menu item panel
- [x] 2.3 Implement `loadWinePairings(wineListId)` — fetches `GET /api/{slug}/wine-list/:id/pairings` and calls `renderWinePairingList`
- [x] 2.4 Implement `renderWinePairingList(pairings, wineListId)` — renders each paired menu item as a row with name, category, and a Remove button; shows empty state when none
- [x] 2.5 Implement the menu item search combo — filters the in-memory `menuItems` array on input (debounced, same pattern as beverage combo); on select, POSTs `{ menu_item_id }` to `/api/{slug}/wine-list/:id/pairings` and reloads pairings
- [x] 2.6 Wire up Remove buttons — DELETE to `/api/{slug}/wine-list/:id/pairings/:pairingId`, reload pairings on success; show toast on error
- [x] 2.7 Call `loadWinePairings` when an entry is loaded into the form; clear and hide the section on form clear
