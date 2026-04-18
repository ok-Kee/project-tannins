## ADDED Requirements

### Requirement: Racks are admin-defined labels per restaurant
The `racks` table SHALL store rack records with: `id`, `restaurant_id` (FK), and `rack_number` (TEXT — admin-defined label such as "A1", "42", "BTG"). Each rack belongs to one restaurant.

#### Scenario: Rack list is restaurant-scoped
- **WHEN** the admin opens the Rack # dropdown on the entry form
- **THEN** only racks where `racks.restaurant_id` matches the current restaurant are shown

### Requirement: Rack assignment is optional on wine list entries
The `rack_id` field on `wine_list` SHALL be nullable. Not all beverages need a rack assignment (e.g., BTG items may not have a physical rack location).

#### Scenario: Entry saved without rack assignment
- **WHEN** admin saves a wine list entry with no rack selected
- **THEN** `rack_id` is stored as NULL and no error is raised

### Requirement: Racks are seeded for MVP via script or direct DB insert
For MVP, rack records SHALL be creatable via the seed script or a `/setup` admin route. A full rack CRUD UI is not required.

#### Scenario: Seed script creates rack records
- **WHEN** the seed script runs for Tannins Bar
- **THEN** rack records are inserted into the `racks` table for that restaurant
