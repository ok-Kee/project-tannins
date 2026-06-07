## Context

Project Tannins is a Node/Express/SQLite admin PWA for restaurant wine list management. The `menu_item_pairings` join table already links `wine_list.id` ↔ `menu_items.id`, but it is only queryable from the menu item side. The wine detail form (Wine tab, right-hand edit panel in admin) has no way to see or manage these relationships. Menu items are already fully loaded into the JS variable `menuItems` in the admin page on init.

## Goals / Non-Goals

**Goals:**
- Show all menu item pairings for the selected wine in the wine detail form
- Allow adding a pairing by searching the in-memory menu item list and selecting
- Allow removing a pairing from the wine side
- Reflect changes immediately on the menu item side (same join table row)

**Non-Goals:**
- Displaying wine-side pairings on the public server lookup page (separate change)
- Reordering pairings
- Bulk pairing operations

## Decisions

**Inline section vs. separate panel** — The menu item side uses a full-panel swap (`openPairingPanel`). For the wine side, an inline section at the bottom of the wine form is simpler: the form is already scrollable and the pairing section only needs to be visible when a wine entry is loaded. No panel-swap needed; show/hide via `display:none` when no entry is selected.

**New endpoints vs. reusing menu-item endpoints** — The menu-item endpoints (`/api/{slug}/menu-items/:id/pairings`) are keyed by `menu_item_id`. A wine-keyed API (`/api/{slug}/wine-list/:id/pairings`) is the correct REST shape for looking up pairings by wine. POST to the new endpoint accepts `{ menu_item_id }` and inserts into `menu_item_pairings`; DELETE removes by `pairing_id`. Both share the same table.

**Auth** — GET is unauthenticated (consistent with other wine-list GET routes). POST and DELETE require `basicAuth` (consistent with all write routes).

**Menu item search** — Filter against the `menuItems` array already in memory (same pattern as the existing beverage combo in the wine form). No new fetch needed.

## Risks / Trade-offs

- **Stale `menuItems` data** — Menu items are loaded once on page init. If a menu item is added in another tab, it won't appear in the search until reload. Acceptable given the single-admin usage pattern.
- **Pairing visibility on server page** — Pairings added from the wine side will appear on the menu item pairing view in admin immediately, but the server-facing cuisine page is a separate concern and not changed here.

## Migration Plan

No schema changes. New endpoints are additive. No deploy coordination needed beyond a normal push.
