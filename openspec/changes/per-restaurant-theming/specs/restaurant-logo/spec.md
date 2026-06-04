## MODIFIED Requirements

### Requirement: Admin page provides logo upload UI
The admin page SHALL include a logo upload section. The section SHALL show the current logo image if one exists, a file input accepting JPG/PNG images, two `<input type="color">` pickers labeled "Accent Color" and "Background Color", and a Save button that submits the logo and theme colors to the server. The color pickers SHALL be pre-filled with the restaurant's current `theme_accent` and `theme_bg` values, or with default placeholder values (`#9b3f5e` and `#1c1a18`) when none are set. Adjusting either color picker SHALL call `applyTheme()` immediately so the admin sees a live preview of the derived palette.

#### Scenario: Current logo shown in admin
- **WHEN** admin loads the admin page and a logo is set
- **THEN** the current logo image is displayed in the logo section

#### Scenario: Color pickers pre-filled from saved values
- **WHEN** admin loads the admin page and the restaurant has `theme_accent` and `theme_bg` set
- **THEN** the Accent Color picker shows `theme_accent` and the Background Color picker shows `theme_bg`

#### Scenario: Color pickers show defaults when no theme set
- **WHEN** admin loads the admin page and `theme_accent` and `theme_bg` are both null
- **THEN** the Accent Color picker shows `#9b3f5e` and the Background Color picker shows `#1c1a18`

#### Scenario: Live preview on color change
- **WHEN** admin adjusts either color picker
- **THEN** `applyTheme()` is called with the current picker values and the page colors update immediately

#### Scenario: Logo uploaded and saved
- **WHEN** admin selects a JPG or PNG file and clicks Save
- **THEN** the file is uploaded to `/uploads/{slug}/` and `restaurants.logo_image_path` is updated

#### Scenario: Theme colors saved with logo save
- **WHEN** admin clicks Save (with or without a new logo file)
- **THEN** `theme_accent` and `theme_bg` from the color pickers are persisted to the database

#### Scenario: Non-image file rejected
- **WHEN** admin attempts to upload a file that is not JPG or PNG
- **THEN** the server returns a 400 error and the logo is not changed

### Requirement: Logo upload endpoint
A `PUT /api/:slug/restaurant` endpoint SHALL accept a multipart form with an optional `logo_image` file field, optional `theme_accent` text field, and optional `theme_bg` text field. The endpoint SHALL update any provided fields on the restaurant record. The endpoint SHALL require HTTP Basic Auth.

#### Scenario: Authenticated upload succeeds
- **WHEN** an authenticated request is sent to `PUT /api/:slug/restaurant` with a valid image
- **THEN** the server stores the file and responds 200 with the updated path

#### Scenario: Theme colors persisted via PUT
- **WHEN** an authenticated `PUT /api/:slug/restaurant` request includes `theme_accent` and `theme_bg` body fields
- **THEN** the restaurant record is updated with the new color values and the response includes the updated fields

#### Scenario: Unauthenticated upload rejected
- **WHEN** an unauthenticated request is sent to `PUT /api/:slug/restaurant`
- **THEN** the server responds 401
