## ADDED Requirements

### Requirement: Admin page header contains a Server View navigation button
The admin page header SHALL include a "Server View" button that opens `/{slug}/server` in a new browser tab.

#### Scenario: Server View button opens server page in new tab
- **WHEN** admin clicks the "Server View" button in the admin header
- **THEN** `/{slug}/server` opens in a new browser tab

### Requirement: Server page header contains an Admin navigation button
The server lookup page header SHALL include an "Admin" button that opens `/{slug}/de` in a new browser tab.

#### Scenario: Admin button opens admin page in new tab
- **WHEN** a user clicks the "Admin" button in the server page header
- **THEN** `/{slug}/de` opens in a new browser tab (and prompts for credentials)

### Requirement: Cuisine page header contains an Admin navigation button
The cuisine server page header SHALL include an "Admin" button that opens `/{slug}/de` in a new browser tab.

#### Scenario: Admin button on cuisine page opens admin in new tab
- **WHEN** a user clicks the "Admin" button in the cuisine page header
- **THEN** `/{slug}/de` opens in a new browser tab

### Requirement: Navigation buttons are touch-friendly
All cross-page navigation buttons SHALL meet the minimum 44×44px touch target size.

#### Scenario: Touch target size on tablet
- **WHEN** any page renders on a tablet viewport
- **THEN** navigation buttons in the header have a minimum 44×44px tap target
