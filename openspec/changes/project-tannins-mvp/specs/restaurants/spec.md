## ADDED Requirements

### Requirement: Each restaurant is identified by a unique URL slug
The `restaurants` table SHALL have a `slug` column (TEXT, UNIQUE) used as the URL segment in all tenant-scoped routes. No two restaurants may share a slug.

#### Scenario: Slug uniqueness enforced
- **WHEN** an attempt is made to insert a restaurant with a slug that already exists
- **THEN** the database raises a UNIQUE constraint violation and the operation is rejected

### Requirement: All tenant data is scoped to restaurant_id
Every record in `wine_list`, `racks`, and related tables SHALL include a `restaurant_id` foreign key referencing `restaurants.id`. Queries for restaurant-scoped data MUST filter by `restaurant_id` derived from the authenticated slug.

#### Scenario: Data isolation between restaurants
- **WHEN** admin of restaurant A requests their wine list
- **THEN** only records where `wine_list.restaurant_id` equals restaurant A's id are returned

#### Scenario: Cross-tenant access prevented
- **WHEN** a request is made for data belonging to restaurant B while authenticated as restaurant A
- **THEN** the response contains no records from restaurant B

### Requirement: Restaurant records are seeded manually for MVP
For MVP, restaurant records (slug, name, http_user, http_pass_hash) SHALL be inserted via a seed script. There is no self-serve signup UI.

#### Scenario: Seed script creates restaurant record
- **WHEN** the seed script runs with restaurant configuration
- **THEN** a record is inserted into `restaurants` with a bcrypt-hashed password
