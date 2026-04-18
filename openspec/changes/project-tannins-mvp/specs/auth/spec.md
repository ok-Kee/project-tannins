## ADDED Requirements

### Requirement: Admin routes are protected by HTTP Basic Auth
All routes under `/waitingfortips/{slug}/de` and `/waitingfortips/{slug}/setup` SHALL require a valid HTTP Basic Auth credential matching the restaurant identified by `slug`. Unauthenticated or incorrectly-credentialed requests SHALL receive a 401 response with a `WWW-Authenticate` header.

#### Scenario: Valid credentials accepted
- **WHEN** a request includes a valid Base64-encoded `Authorization: Basic` header matching the restaurant's `http_user` and password (verified against `http_pass_hash` via bcrypt)
- **THEN** the request proceeds to the route handler

#### Scenario: Missing credentials rejected
- **WHEN** a request to an admin route has no `Authorization` header
- **THEN** the server responds with HTTP 401 and a `WWW-Authenticate: Basic realm="Tannins Admin"` header

#### Scenario: Wrong credentials rejected
- **WHEN** a request includes credentials that do not match the restaurant record
- **THEN** the server responds with HTTP 401

#### Scenario: Credentials are restaurant-scoped
- **WHEN** a valid credential for restaurant A is used on the `/de` route of restaurant B
- **THEN** the server responds with HTTP 401

### Requirement: Passwords are stored as bcrypt hashes
The `restaurants.http_pass_hash` column SHALL store the bcrypt hash of the plaintext password. Plaintext passwords SHALL never be persisted.

#### Scenario: Password verification
- **WHEN** the auth middleware compares a submitted password against the stored hash
- **THEN** bcrypt.compare is used; a timing-safe comparison is guaranteed

### Requirement: Server lookup routes require no authentication
Routes under `/waitingfortips/{slug}/server` SHALL be publicly accessible without any credentials.

#### Scenario: Unauthenticated server access
- **WHEN** any client requests `/waitingfortips/{slug}/server`
- **THEN** the response is served without checking for an Authorization header
