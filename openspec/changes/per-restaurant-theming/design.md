## Context

All four Tannins pages currently hardcode their color palette as CSS custom properties in a `:root` block. The values are identical across every page and every restaurant. The goal is to allow each restaurant to supply two brand colors (accent and background) and have the full palette derived from those at page-load time with no server-side rendering or build step.

## Goals / Non-Goals

**Goals:**
- Store two brand colors per restaurant in the database
- Derive a full CSS variable palette from those two inputs on the client
- Apply the theme before first paint to avoid a flash of the default colors
- Allow admin to configure and preview colors in real time
- Seed Tannins Bar with its gold/black theme

**Non-Goals:**
- Light-mode themes (all restaurants use dark themes; a future change could add a `theme_mode` flag)
- Per-page or per-section color overrides
- Font or typography customization
- Exposing more than two color inputs to the admin

## Decisions

### 1. Two inputs, full palette derived in JS

Rather than storing 8 CSS variables per restaurant, we store only `theme_accent` and `theme_bg`. The remaining variables (`--surface`, `--surface2`, `--border`, `--accent-hover`, `--text-muted`) are derived via HSL math in a shared `applyTheme()` function inlined on each page.

Alternatives considered:
- **Store all 8 variables**: Maximum control, but the admin UX becomes a color-picker nightmare and colors can be set to combinations that look terrible together.
- **Store a theme name (enum)**: Simplest DB schema, but defeats the purpose of per-restaurant branding.

### 2. Theme application happens in the `init()` fetch, not a separate request

Every page already calls `GET /api/:slug/restaurant` to load the logo. We add `theme_accent` and `theme_bg` to that response and call `applyTheme()` immediately after receiving it. This means one network round-trip covers both logo and theme.

The theme is applied by setting inline styles on `document.documentElement`, which override the `:root` CSS rules.

### 3. Color math in pure JS (no library)

The derivation requires hex→HSL→hex conversion and simple lightness/saturation adjustments — roughly 30 lines of code. No external dependency is justified for this.

Derivation rules:
| Variable | Derivation |
|---|---|
| `--accent` | `theme_accent` directly |
| `--accent-hover` | accent hue/sat, lightness +12% |
| `--bg` | `theme_bg` directly |
| `--surface` | bg hue/sat, lightness +5% |
| `--surface2` | bg hue/sat, lightness +10% |
| `--border` | bg hue/sat, lightness +18% |
| `--text-muted` | accent hue, saturation ×0.4, lightness 58% |

`--text`, `--green`, `--red-warn`, `--radius`, `--font` are not touched.

### 4. No flash of unstyled content

`applyTheme()` is called synchronously inside the `init()` async function immediately after the `await fetch(...)` resolves. Because the page renders into the existing `:root` colors first and then switches, there may be a brief flash on slow connections. This is acceptable for an internal server tool; a future optimization could embed the theme inline in a `<style>` tag via server-side rendering.

### 5. Admin live preview

The color pickers call `applyTheme()` on every `input` event, giving immediate visual feedback. The colors are only persisted to the database when the admin clicks Save. On cancel/reload, the persisted colors are reloaded.

## Risks / Trade-offs

- **Flash on slow connections** → Acceptable for internal tool; mitigable later with SSR if needed.
- **Derived colors may clash on unusual inputs** → Admin sees live preview, so they can correct bad choices before saving. No server-side validation of aesthetics is practical.
- **Lightness derivation assumes a dark background** → If `theme_bg` is a light color, `--surface` will be lighter still and text may become unreadable. Mitigated by the live preview; future improvement could add a min/max clamp.

## Migration Plan

1. Run `npm run db:init` (with `DB_PATH` set) on the live Render disk to add the two new columns
2. Deploy the updated code
3. From the admin page, open the Theme section, confirm the color pickers appear, and set Tannins Bar's colors (or rely on the node seed script)
4. Alternatively, run `node -e "..."` one-liner in Render Shell to seed Tannins Bar's colors directly

Rollback: revert the deploy. The new columns are additive; existing data is unaffected. Pages without theme values fall back to default colors automatically.
