## ADDED Requirements

### Requirement: Beverages table is a shared master list
The `beverages` table SHALL store canonical beverage records shared across all restaurants. Each record has: `id`, `name` (TEXT), `type` (TEXT — one of: White, Red, Rosé, Champagne, Sparkling Wine, Beer, Cocktail, Mocktail, Soda, Orange, Dessert), and `general_pairing` (TEXT, nullable).

#### Scenario: Beverage exists once in master list
- **WHEN** a beverage name is looked up via the admin combo box
- **THEN** results are returned from the shared `beverages` table regardless of which restaurant is active

### Requirement: General pairing is auto-populated from the master list
When an admin selects a beverage in the data-entry form, the `general_pairing` field SHALL be auto-populated (read-only) from `beverages.general_pairing`.

#### Scenario: Auto-populate on beverage select
- **WHEN** admin selects a beverage from the combo box
- **THEN** the General Pairing textarea is populated with `beverages.general_pairing` and marked read-only

#### Scenario: Empty general pairing displayed gracefully
- **WHEN** a beverage has a null or empty `general_pairing`
- **THEN** the textarea is blank; no error is shown

### Requirement: Beverage combo box supports search-as-you-type
The beverage selection input in both admin and server views SHALL perform a case-insensitive prefix/substring search against `beverages.name` as the user types, with results appearing within 300ms.

#### Scenario: Substring search returns matches
- **WHEN** admin types "pinot" in the beverage combo box
- **THEN** all beverages with "pinot" in their name are displayed as options

#### Scenario: No matches shows empty state
- **WHEN** admin types a string matching no beverage names
- **THEN** an empty state message is shown (e.g., "No beverages found")
