## ADDED Requirements

### Requirement: restaurants table stores a logo image path
The `restaurants` table SHALL have a nullable `logo_image_path TEXT` column. This column stores the relative path to the restaurant's uploaded logo image.

#### Scenario: Column exists after db-init
- **WHEN** `npm run db:init` is run on an existing database
- **THEN** `restaurants.logo_image_path` exists and is nullable

#### Scenario: Column is null by default
- **WHEN** a restaurant record exists with no logo uploaded
- **THEN** `logo_image_path` is NULL

### Requirement: Admin page provides logo upload UI
The admin page SHALL include a logo upload section. The section SHALL show the current logo image if one exists, a file input accepting JPG/PNG images, and a Save button that submits the logo to the server.

#### Scenario: Current logo shown in admin
- **WHEN** admin loads the admin page and a logo is set
- **THEN** the current logo image is displayed in the logo section

#### Scenario: Logo uploaded and saved
- **WHEN** admin selects a JPG or PNG file and clicks Save
- **THEN** the file is uploaded to `/uploads/{slug}/` and `restaurants.logo_image_path` is updated

#### Scenario: Non-image file rejected
- **WHEN** admin attempts to upload a file that is not JPG or PNG
- **THEN** the server returns a 400 error and the logo is not changed

### Requirement: Logo upload endpoint
A `PUT /api/:slug/restaurant` endpoint SHALL accept a multipart form with an optional `logo_image` file field and update `restaurants.logo_image_path`. The endpoint SHALL require HTTP Basic Auth.

#### Scenario: Authenticated upload succeeds
- **WHEN** an authenticated request is sent to `PUT /api/:slug/restaurant` with a valid image
- **THEN** the server stores the file and responds 200 with the updated path

#### Scenario: Unauthenticated upload rejected
- **WHEN** an unauthenticated request is sent to `PUT /api/:slug/restaurant`
- **THEN** the server responds 401
