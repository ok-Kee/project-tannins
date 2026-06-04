## ADDED Requirements

### Requirement: Landing page served at /{slug}
A per-restaurant landing page SHALL be served at `/{slug}` with no authentication required. The page SHALL display the restaurant's logo (or a placeholder if none is set) and two navigation buttons.

#### Scenario: Landing page loads without auth
- **WHEN** any client navigates to `/tannins-bar`
- **THEN** the landing page is displayed without a credential prompt

#### Scenario: Unknown slug returns 404
- **WHEN** a client navigates to a slug that does not exist in the database
- **THEN** the server returns a 404 response

### Requirement: Landing page displays restaurant logo
The landing page SHALL display the restaurant's logo image if `logo_image_path` is set on the restaurant record. If no logo is set, a decorative placeholder (silhouette or icon) SHALL be shown instead.

#### Scenario: Logo displayed when set
- **WHEN** the restaurant has a `logo_image_path` set
- **THEN** the logo image is rendered prominently on the landing page

#### Scenario: Placeholder displayed when no logo
- **WHEN** the restaurant has no `logo_image_path`
- **THEN** a placeholder graphic is displayed in place of the logo

### Requirement: Landing page provides navigation to Beverages and Cuisine
The landing page SHALL display two large, touch-friendly buttons: "Beverages" and "Cuisine". Tapping "Beverages" navigates to `/{slug}/server`. Tapping "Cuisine" navigates to `/{slug}/cuisine`. Both navigate in the same tab.

#### Scenario: Beverages button navigates to server page
- **WHEN** a user taps the "Beverages" button
- **THEN** the browser navigates to `/{slug}/server`

#### Scenario: Cuisine button navigates to cuisine page
- **WHEN** a user taps the "Cuisine" button
- **THEN** the browser navigates to `/{slug}/cuisine`

#### Scenario: Buttons meet touch target size
- **WHEN** the landing page renders on a tablet viewport
- **THEN** both buttons have a minimum tap target of 44×44px
