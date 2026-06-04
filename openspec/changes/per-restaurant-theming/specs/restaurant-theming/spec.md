## ADDED Requirements

### Requirement: restaurants table stores theme colors
The `restaurants` table SHALL have two nullable columns: `theme_accent TEXT` and `theme_bg TEXT`. Both store a CSS hex color string (e.g. `#C9A84C`). Both are nullable; a null value means no custom theme is set for that restaurant.

#### Scenario: Columns exist after db-init
- **WHEN** `npm run db:init` is run on an existing database
- **THEN** `restaurants.theme_accent` and `restaurants.theme_bg` exist and are nullable

#### Scenario: Columns are null by default
- **WHEN** a restaurant record exists with no theme configured
- **THEN** both `theme_accent` and `theme_bg` are NULL

### Requirement: Restaurant API returns theme colors
The `GET /api/:slug/restaurant` endpoint SHALL include `theme_accent` and `theme_bg` in its JSON response alongside the existing `name` and `logo_image_path` fields.

#### Scenario: Theme colors returned when set
- **WHEN** a restaurant has `theme_accent` and `theme_bg` configured
- **THEN** `GET /api/:slug/restaurant` returns both fields with their hex string values

#### Scenario: Theme colors returned as null when not set
- **WHEN** a restaurant has no theme configured
- **THEN** `GET /api/:slug/restaurant` returns `theme_accent: null` and `theme_bg: null`

### Requirement: Theme colors are applied as CSS custom properties on page load
Every page (landing, server, cuisine, admin) SHALL fetch `GET /api/:slug/restaurant` on load and, if `theme_accent` and `theme_bg` are both non-null, SHALL apply a derived color palette as CSS custom properties on `document.documentElement`.

#### Scenario: Theme applied when both colors are set
- **WHEN** a page loads for a restaurant with `theme_accent` and `theme_bg` set
- **THEN** `--accent`, `--accent-hover`, `--bg`, `--surface`, `--surface2`, `--border`, and `--text-muted` are overridden on `document.documentElement`

#### Scenario: No theme applied when colors are null
- **WHEN** a page loads for a restaurant with no theme set
- **THEN** the CSS custom properties are not modified and the hardcoded `:root` values remain active

#### Scenario: Derived palette is consistent
- **WHEN** `theme_accent = #C9A84C` and `theme_bg = #0A0A0A`
- **THEN** `--surface` is lighter than `--bg`, `--surface2` is lighter than `--surface`, `--border` is lighter than `--surface2`, and `--accent-hover` is lighter than `--accent`

### Requirement: Theme color derivation uses HSL math
The `applyTheme(accent, bg)` function SHALL convert hex colors to HSL, apply lightness/saturation adjustments, and convert back to hex. No external library SHALL be used.

#### Scenario: Color utility handles valid hex input
- **WHEN** `applyTheme('#C9A84C', '#0A0A0A')` is called
- **THEN** all derived CSS variables are valid CSS color values

#### Scenario: Color utility is a no-op for null inputs
- **WHEN** `applyTheme(null, null)` or `applyTheme(undefined, undefined)` is called
- **THEN** no CSS custom properties are modified

### Requirement: Tannins Bar has gold/black theme seeded
Tannins Bar's restaurant record SHALL have `theme_accent = '#C9A84C'` and `theme_bg = '#0A0A0A'` set in the database.

#### Scenario: Tannins Bar theme colors are set
- **WHEN** the Tannins Bar theme seed is applied
- **THEN** `GET /api/tannins-bar/restaurant` returns `theme_accent: '#C9A84C'` and `theme_bg: '#0A0A0A'`
