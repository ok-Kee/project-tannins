# Data Model

SQLite, created/migrated by `scripts/db-init.js` (idempotent — safe to re-run; runs on boot
in production).

## Tables

| Table | Scope | Key columns |
|---|---|---|
| `restaurants` | one row per tenant | `slug`, `name`, `http_user`, `http_pass_hash` (bcrypt), `logo_image_path`, `theme_accent`, `theme_bg` |
| `beverages` | **global, shared across tenants** | `name`, `type`, `general_pairing`, `flavor_profile` |
| `wine_list` | per-restaurant | `restaurant_id`, `beverage_id`, `rack_id`, pricing, images, `sommelier_comments`, `house_name`, `house_type`, `house_pairing`, `house_flavor_profile`, `snack_notes` |
| `racks` | per-restaurant | `restaurant_id`, `rack_number` |
| `menu_items` | per-restaurant | `restaurant_id`, `name`, `description`, `category`, `price`, `sort_order` |
| `menu_item_pairings` | per-restaurant | join `menu_item_id` ↔ `wine_list_id` (cascade delete) |

A `wine_list` entry links a shared `beverage` to a restaurant with that restaurant's pricing,
photos, rack, and notes.

## The shared-vs-override field model

This is the central design decision. Two kinds of descriptive text:

- **Shared, AI-generated, intrinsic to the wine** → lives on `beverages` (one value seen by
  every restaurant carrying that wine):
  - `general_pairing` — food pairings.
  - `flavor_profile` — tasting notes (what it tastes like).
- **Per-restaurant overrides** → live on `wine_list` (each restaurant's own value):
  - `house_pairing` — overrides `general_pairing`.
  - `house_flavor_profile` — overrides `flavor_profile`.
  - `house_name` — overrides the catalog `name`.
  - `house_type` — overrides the catalog `type`.

**Why `name`/`type` are override-able:** they live on the shared `beverages` catalog, so a
restaurant editing them in place would change the wine for *every* tenant carrying it. The
override lets a restaurant rename/retype **their own copy** while the canonical catalog stays
clean (correcting the canonical catalog itself is a separate, owner-only concern — not yet built).

**Display rule (server + cuisine modals):** show the house override if present, else the
shared note — `house_pairing || general_pairing` renders as one **"Pairing"** section, and
`house_flavor_profile || flavor_profile` as one **"Flavor Profile"** section. Blank until the
AI seed runs *and* no override is set. `house_pairing`/`house_flavor_profile` are resolved on
the **frontend** (they're plain display text).

`house_name`/`house_type` are resolved on the **server** instead — the `wine_list` queries
alias `COALESCE(wl.house_name, b.name) AS beverage_name` (and same for `type`), because those
fields also drive sorting, type-filter chips, and search on the guest pages. The canonical
values are returned alongside as `catalog_name`/`catalog_type` so the admin form can tell
whether the Name/Type fields were customized.

**Admin:** the shared field shows read-only (auto-filled when a beverage is selected) with its
editable override directly beneath it — General Pairing → House Pairing, Flavor Profile →
House Flavor Profile. `sommelier_comments` and `snack_notes` are plain per-restaurant fields
with no shared counterpart.

`house_name`/`house_type` are the exception: there are **no** separate override fields. The
Beverage Name and Type inputs are edited directly, and on save the admin compares the value to
the linked beverage's canonical `catalog_name`/`catalog_type`. A difference is stored as the
override; matching (or blank) clears it. New entries and re-linking to a catalog beverage via
the search dropdown reset the baseline, so they never create a spurious override. This keeps
per-restaurant renames out of the shared catalog while avoiding extra form clutter.

> When adding another "override-able" field, only `beverages`-level (shared) data warrants the
> pattern; everything in `wine_list`/`menu_items` is already per-tenant. Implement it
> concretely (a `house_*` column + the `||` display), not as a generic abstraction.

## Markdown in notes
The note fields render limited markdown on the guest pages (`mdToHtml`): `**bold**` and
`- `/`* ` bullets. Menu `description` renders as **plain text** (no markdown). Stored as raw
text/markdown, not HTML.

## Adding a column
Add it to the `CREATE TABLE` in `db-init.js` **and** add a guarded
`ALTER TABLE … ADD COLUMN` (the try/catch that ignores "duplicate column name") so existing
production databases pick it up on the next boot. If it's a `beverages` field surfaced through
the wine list, add it to the `SELECT` in `src/routes/wineList.js` (the GET uses explicit
columns for `b.*`, not `SELECT b.*`).
