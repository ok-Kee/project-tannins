## MODIFIED Requirements

### Requirement: Server lookup UI is accessible at /{slug}/server
The server read-only interface SHALL be served at `/{slug}/server` with no authentication required. (Previously `/waitingfortips/{slug}/server`.)

#### Scenario: Unauthenticated server accesses lookup
- **WHEN** any client navigates to `/tannins-bar/server`
- **THEN** the lookup interface is displayed without a credential prompt

#### Scenario: Old URL is no longer served
- **WHEN** a client navigates to `/waitingfortips/tannins-bar/server`
- **THEN** the server returns 404
