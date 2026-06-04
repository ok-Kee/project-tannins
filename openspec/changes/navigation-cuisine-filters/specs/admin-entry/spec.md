## MODIFIED Requirements

### Requirement: Admin entry UI is accessible at /{slug}/de
The admin data-entry interface SHALL be served at `/{slug}/de` and SHALL be protected by HTTP Basic Auth as defined in the auth spec. (Previously `/waitingfortips/{slug}/de`.)

#### Scenario: Authenticated admin reaches entry UI
- **WHEN** an authenticated admin navigates to `/tannins-bar/de`
- **THEN** the data-entry form is displayed

#### Scenario: Unauthenticated request redirected
- **WHEN** an unauthenticated user navigates to the admin URL
- **THEN** the browser prompts for credentials (401 + WWW-Authenticate header)

#### Scenario: Old URL is no longer served
- **WHEN** a client navigates to `/waitingfortips/tannins-bar/de`
- **THEN** the server returns 404
