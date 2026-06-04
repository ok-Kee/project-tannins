## ADDED Requirements

### Requirement: Cuisine server page served at /{slug}/cuisine
A cuisine lookup page SHALL be served at `/{slug}/cuisine` with no authentication required.

#### Scenario: Page loads without auth
- **WHEN** any client navigates to `/tannins-bar/cuisine`
- **THEN** the cuisine page is displayed without a credential prompt

### Requirement: Cuisine page lists menu items grouped by category
The cuisine page SHALL fetch and display all menu items for the restaurant. If menu items have categories set, they SHALL be grouped under their category heading. Items without a category SHALL appear under an "Other" group or ungrouped at the end.

#### Scenario: Menu items displayed grouped by category
- **WHEN** the cuisine page loads and menu items have categories set
- **THEN** items are displayed under their respective category headings

#### Scenario: Items without category displayed last
- **WHEN** some menu items have no category
- **THEN** those items appear after all categorized groups

#### Scenario: Empty state when no menu items exist
- **WHEN** the restaurant has no menu items configured
- **THEN** a friendly empty state message is displayed (e.g., "No menu items set up yet. Ask your manager to configure the menu in the admin panel.")

### Requirement: Selecting a menu item reveals its beverage pairings
Tapping a menu item on the cuisine page SHALL expand or navigate to show the paired beverages for that dish. If no pairings exist for the selected item, a friendly empty state SHALL be shown.

#### Scenario: Paired beverages shown on item selection
- **WHEN** a server taps a menu item that has pairings configured
- **THEN** the paired beverages are displayed as a list with name, type, and prices

#### Scenario: Empty state for item with no pairings
- **WHEN** a server taps a menu item that has no pairings
- **THEN** a message is displayed such as "No pairings set up for this dish yet."

### Requirement: Tapping a paired beverage opens the detail modal
Tapping a paired beverage on the cuisine page SHALL open the same detail modal used on the server lookup page, showing all available fields: general_pairing, house_pairing, sommelier_comments, snack_notes, prices, rack number, label image, bottle image.

#### Scenario: Detail modal opens on beverage tap
- **WHEN** a server taps a paired beverage entry on the cuisine page
- **THEN** the detail modal opens with that beverage's full details

#### Scenario: Detail modal is read-only
- **WHEN** the detail modal is open on the cuisine page
- **THEN** no input fields or edit controls are shown

#### Scenario: Closing the modal returns to pairings view
- **WHEN** the server closes the detail modal
- **THEN** the modal closes and the cuisine page is restored to the selected menu item's pairings view

### Requirement: Cuisine page is tablet-optimized
The cuisine server page SHALL be usable on a standard tablet with touch-friendly targets (minimum 44×44px) and legible typography, consistent with the server lookup page.

#### Scenario: Touch targets on tablet
- **WHEN** the cuisine page renders on a tablet viewport
- **THEN** all interactive elements meet minimum 44×44px touch target size
