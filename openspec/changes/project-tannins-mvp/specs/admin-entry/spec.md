## ADDED Requirements

### Requirement: Admin entry UI is accessible at /waitingfortips/{slug}/de
The admin data-entry interface SHALL be served at the path `/waitingfortips/{slug}/de` and SHALL be protected by HTTP Basic Auth as defined in the auth spec.

#### Scenario: Authenticated admin reaches entry UI
- **WHEN** an authenticated admin navigates to `/waitingfortips/tannins-bar/de`
- **THEN** the data-entry form is displayed

#### Scenario: Unauthenticated request redirected
- **WHEN** an unauthenticated user navigates to the admin URL
- **THEN** the browser prompts for credentials (401 + WWW-Authenticate header)

### Requirement: Admin form supports create and update of wine list entries
The form SHALL support both creating new entries and editing existing ones. Selecting an existing entry from the wine list SHALL pre-populate all form fields. Saving SHALL write to `wine_list` (INSERT or UPDATE).

#### Scenario: New entry creation
- **WHEN** admin fills in the form and clicks Save
- **THEN** a new record is inserted into `wine_list` and appears in the entry list

#### Scenario: Existing entry edit
- **WHEN** admin selects an existing wine list entry
- **THEN** all form fields are pre-populated with the record's current values

#### Scenario: Edited entry saved
- **WHEN** admin modifies fields and clicks Save on an existing entry
- **THEN** the record is updated in `wine_list` with the new values and `updated_at` timestamp

### Requirement: Form fields match the wine list schema
The admin form SHALL include the following fields:

| Field | Input Type | Notes |
|---|---|---|
| Rack # | Dropdown (select) | Populated from this restaurant's rack list; nullable |
| Beverage name | Combo box (search-as-you-type) | Searches master beverages table |
| Type | Checkboxes | White, Red, Rosé, Champagne, Sparkling Wine, Beer, Cocktail, Mocktail, Soda |
| Sommelier Comments | Textarea | Free text |
| General Pairing | Textarea (read-only) | Auto-filled from beverages.general_pairing on beverage select |
| House Pairing | Textarea | Restaurant-specific pairings |
| Price BTL | Currency input | Decimal; optional |
| Price BTG | Currency input | Decimal; optional |
| Label image | File upload | JPG/PNG; stored to /uploads/{slug}/ |
| Bottle image | File upload | JPG/PNG; stored to /uploads/{slug}/ |
| Snack | Textarea | Snack pairing notes |

#### Scenario: General Pairing auto-fills on beverage select
- **WHEN** admin selects a beverage from the combo box
- **THEN** the General Pairing textarea is populated with the beverage's `general_pairing` value and is not editable

#### Scenario: Type checkboxes allow multiple selection
- **WHEN** admin checks multiple type checkboxes (e.g., Sparkling Wine + Rosé)
- **THEN** all selected types are stored (comma-separated or JSON) on the wine list record

### Requirement: Admin wine list shows all entries for current restaurant
The admin UI SHALL display a list or table of all existing wine list entries for the current restaurant, with enough detail (beverage name, rack, prices) to identify and select entries for editing.

#### Scenario: Entry list displays after save
- **WHEN** admin saves a new or updated entry
- **THEN** the entry appears in the list with current values
