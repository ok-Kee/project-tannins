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
| `menu_item_pairings` | per-restaurant | join `menu_item_id` ↔ `wine_list_id` (cascade delete); `ai_pairing_text`, `house_pairing_text` |

A `wine_list` entry links a shared `beverage` to a restaurant with that restaurant's pricing,
photos, rack, and notes.

## The shared-vs-override field model

This is the central design decision. Two kinds of descriptive text:

- **Shared, AI-generated, intrinsic to the wine** → lives on `beverages` (one value seen by
  every restaurant carrying that wine):
  - `flavor_profile` — tasting notes (what it tastes like).
  - `general_pairing` — **retired.** Generic food-pairing copy, superseded by real menu
    pairings (see below). The column and `wine_list.house_pairing` remain for back-compat but
    are no longer written or surfaced.
- **Per-restaurant overrides** → live on `wine_list` (each restaurant's own value):
  - `house_flavor_profile` — overrides `flavor_profile`.
  - `house_name` — overrides the catalog `name`.
  - `house_type` — overrides the catalog `type`.

### Menu pairings (the "Pairing" section)

The beverage "Pairing" a server sees is now built from **real menu pairings**, not generic
copy. Each `menu_item_pairings` row (a per-tenant dish↔beverage link) carries:
- `ai_pairing_text` — the LLM's note for *this dish + this beverage*, written at generation
  time by `seed:pairings`.
- `house_pairing_text` — the restaurant's per-entry override.

Display rule: `house_pairing_text || ai_pairing_text`, per pairing. Because the text lives on
the pairing row, the model is inherently dynamic — removing a pairing removes its note (the
join is `ON DELETE CASCADE`), and there is no shared/global blob to keep in sync. Unlike the
old `general_pairing` (which needed a `house_*` override *because* it was shared across
tenants), `menu_item_pairings` is already per-tenant, so the AI-seeded row *is* the
restaurant's own data; the override just edits the wording.

**Guest views:** the server beverage modal renders a "Pairs With" chip list plus a "Pairing"
section listing each paired dish with its `house_pairing_text || ai_pairing_text`; the cuisine
dish→beverage modal shows the specific pairing's note. **Display cap:** the cuisine dish→wine
list shows at most 5 pairings per dish, sampled client-side for a price spread — 2 low, 2 mid,
1 expensive by `price_btl ?? price_btg`, with tiers taken as tertiles of *that dish's* priced
pairings (dishes with ≤5 show all). The sample is stable per page load (a reload re-samples);
the DB keeps every pairing and the `/menu-items/:id/pairings` endpoint (shared with admin) is
unchanged. **Admin:** the per-entry note is edited
inline in the Menu Pairings list (AI note shown read-only, House note editable, saved via
`PATCH …/pairings/:pairingId`); the old global General/House Pairing textareas were removed.

**Why `name`/`type` are override-able:** they live on the shared `beverages` catalog, so a
restaurant editing them in place would change the wine for *every* tenant carrying it. The
override lets a restaurant rename/retype **their own copy** while the canonical catalog stays
clean (correcting the canonical catalog itself is a separate, owner-only concern — not yet built).

**Display rule (server + cuisine modals):** show the house override if present, else the
shared note — `house_flavor_profile || flavor_profile` renders as one **"Flavor Profile"**
section (blank until the AI seed runs *and* no override is set). It is resolved on the
**frontend** (plain display text). The **"Pairing"** section is built from `menu_item_pairings`
instead (see *Menu pairings* above), not from a `beverages`/`wine_list` text field.

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
