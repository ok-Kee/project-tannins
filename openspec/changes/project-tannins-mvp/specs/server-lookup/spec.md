## ADDED Requirements

### Requirement: Server lookup UI is accessible at /waitingfortips/{slug}/server
The server read-only interface SHALL be served at `/waitingfortips/{slug}/server` with no authentication required.

#### Scenario: Unauthenticated server accesses lookup
- **WHEN** any client navigates to `/waitingfortips/tannins-bar/server`
- **THEN** the lookup interface is displayed without a credential prompt

### Requirement: Server can search by rack number or beverage name
The server lookup page SHALL provide two search modes: (1) a dropdown to select a rack number and (2) a search-as-you-type combo box to search by beverage name. Both SHALL filter the wine list for the current restaurant.

#### Scenario: Search by rack number
- **WHEN** server selects a rack from the dropdown
- **THEN** all wine list entries assigned to that rack are shown

#### Scenario: Search by beverage name
- **WHEN** server types a beverage name in the search box
- **THEN** matching wine list entries are shown with type-ahead suggestions

#### Scenario: No results found
- **WHEN** the search returns no matching entries
- **THEN** an empty state message is displayed (e.g., "No wines found")

### Requirement: Selecting an entry opens a read-only detail panel
Selecting a wine list entry from the search results SHALL open a detail modal or panel displaying all relevant fields. No editing is possible in this view.

#### Scenario: Detail panel opens on selection
- **WHEN** server taps/clicks a wine list entry
- **THEN** a modal or panel opens showing: Sommelier Comments, General Pairing, House Pairing, Price BTL, Price BTG, Label image, Bottle image, Snack notes

#### Scenario: Detail panel is read-only
- **WHEN** the detail panel is open
- **THEN** no input fields are editable and no save/delete controls are shown

#### Scenario: Close button dismisses panel
- **WHEN** server taps the Close button on the detail panel
- **THEN** the panel closes and the search view is restored

### Requirement: Server view is tablet-optimized
The server lookup UI SHALL be usable on a standard tablet (10"+ screen) with touch-friendly targets (minimum 44x44px tap targets) and legible typography.

#### Scenario: Touch target size
- **WHEN** server view renders on a 1024x768 tablet viewport
- **THEN** all interactive elements meet minimum 44x44px touch target size
