## ADDED Requirements

### Requirement: Server page displays drink category filter chips
The server lookup page SHALL display a row of filter chips above the results list. The chips SHALL be dynamically generated from the distinct `beverage_type` values present in the restaurant's wine list. An "All" chip SHALL always be present.

#### Scenario: Chips generated from wine list types
- **WHEN** the server page loads and the wine list contains entries with types such as "Red Wine", "White Wine", "Sparkling Wine"
- **THEN** a filter chip for each distinct type is rendered, plus an "All" chip

#### Scenario: All chip shown when no types exist
- **WHEN** the wine list contains entries with no type set
- **THEN** only the "All" chip is shown

### Requirement: All chip is selected by default
When the page loads, the "All" chip SHALL be selected and the full wine list SHALL be displayed.

#### Scenario: Default state shows all entries
- **WHEN** the server page first loads
- **THEN** the "All" chip is active and all wine list entries are displayed

### Requirement: Selecting a category chip filters results
Tapping a category chip SHALL filter the results list to show only entries whose `beverage_type` matches the selected chip. Only one chip SHALL be active at a time (radio behavior). Tapping "All" removes the category filter.

#### Scenario: Category chip filters results
- **WHEN** a user taps the "Red Wine" chip
- **THEN** only wine list entries with `beverage_type = "Red Wine"` are shown and "Red Wine" chip is marked active

#### Scenario: Tapping All chip restores full list
- **WHEN** a category chip is active and the user taps "All"
- **THEN** all entries are shown and the "All" chip is marked active

#### Scenario: Only one chip active at a time
- **WHEN** a user taps a second category chip while another is active
- **THEN** the previously active chip becomes inactive and the newly tapped chip becomes active

### Requirement: Category filter stacks with rack and name filters
The category chip filter SHALL apply in combination with the existing rack dropdown and beverage name search. All three filters are ANDed together.

#### Scenario: Category filter combined with rack filter
- **WHEN** a rack is selected in the dropdown AND a category chip is active
- **THEN** only entries matching both the rack AND the category are shown

#### Scenario: Category filter combined with name search
- **WHEN** text is entered in the beverage name search AND a category chip is active
- **THEN** only entries matching both the name search AND the category are shown
