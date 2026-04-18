## ADDED Requirements

### Requirement: Wine list entries are per-restaurant records
Each record in `wine_list` SHALL belong to exactly one restaurant (via `restaurant_id`) and reference exactly one beverage (via `beverage_id`). Optional fields: `rack_id` (FK to racks), `sommelier_comments`, `house_pairing`, `snack_notes`, `price_btl`, `price_btg`, `label_image_path`, `bottle_image_path`. Timestamps: `created_at`, `updated_at`.

#### Scenario: New entry saved under correct restaurant
- **WHEN** an admin saves a new wine list entry
- **THEN** the record is inserted with `restaurant_id` matching the authenticated slug's restaurant

#### Scenario: Updating an existing entry
- **WHEN** admin opens an existing entry and saves changes
- **THEN** the record is updated in place and `updated_at` is refreshed

### Requirement: Images are stored on the local filesystem
Uploaded label and bottle images SHALL be saved to `/uploads/{slug}/{filename}` and the relative path stored in `label_image_path` / `bottle_image_path`. Accepted formats: JPG, PNG. Max file size enforced by Multer (10MB default).

#### Scenario: Successful label image upload
- **WHEN** admin uploads a valid JPG or PNG as the label image
- **THEN** the file is written to `/uploads/{slug}/` and the path is stored on the wine list record

#### Scenario: Invalid file type rejected
- **WHEN** admin attempts to upload a non-image file (e.g., PDF)
- **THEN** the server responds with a 400 error and no file is saved

### Requirement: Wine list entries can be listed and filtered per restaurant
The admin view SHALL display all wine list entries for the current restaurant, sortable by rack number or beverage name. The server view reads from the same data.

#### Scenario: List returns only current restaurant's entries
- **WHEN** the admin wine list page loads
- **THEN** only entries where `wine_list.restaurant_id` matches the current slug are displayed
