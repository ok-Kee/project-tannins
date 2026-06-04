## Context

Project Tannins is a Node.js/Express PWA with a SQLite backend and vanilla JS frontend. It has two existing page types — a Basic Auth–protected admin data-entry page and a public server lookup page — both served under the `/waitingfortips/{slug}/` prefix. This change adds a landing page, a cuisine pairing workflow, and several UX improvements while breaking the existing URL structure. The first (and currently only) restaurant is Tannins Bar (`slug=tannins-bar`).

## Goals / Non-Goals

**Goals:**
- Remove the `/waitingfortips/` URL prefix from all routes (shorter, cleaner URLs)
- Add a per-restaurant landing page with logo and navigation entry points
- Enable restaurants to manage a food menu and beverage pairings for a cuisine lookup workflow
- Add drink category filter chips to the server lookup page
- Add cross-page navigation buttons (admin ↔ server ↔ cuisine)

**Non-Goals:**
- No AI/Claude API calls at server request time (pairings are pre-configured by admin)
- No Excel/CSV import for menu items or pairings in this change
- No multi-restaurant onboarding UI (restaurants table still populated via seed scripts)
- No changes to the Render deployment configuration

## Decisions

### 1. URL restructuring: simple path change in app.js

The `/waitingfortips/` prefix exists solely in `src/app.js` route definitions. Removing it is a one-file change with no Render, CDN, or proxy configuration involved. There are no stored absolute URLs in the database (image paths are relative). **The only breakage is existing browser bookmarks.** Mitigation: document the URL change in the PR; Tannins Bar is the only active restaurant.

### 2. Schema migration: ALTER TABLE vs. re-init

Two new tables (`menu_items`, `menu_item_pairings`) and one new column (`restaurants.logo_image_path`) are needed. Rather than modifying `db-init.js` to use destructive `DROP/CREATE`, we add `IF NOT EXISTS` guards for the new tables and a conditional `ALTER TABLE` for the new column. This is safe to re-run and preserves existing data.

Alternatives considered:
- A dedicated migration runner (e.g., `better-sqlite3-migrations`): overkill for a single-developer project at this stage; the seed-script pattern is already established.
- Wiping and re-seeding: would lose the enriched `general_pairing` data and any manually entered wine list records.

### 3. menu_item_pairings links to wine_list, not beverages

Pairings join a menu item to a `wine_list` entry rather than directly to `beverages`, because the useful server-facing data (house_pairing, sommelier_comments, prices, rack) lives on `wine_list`. This also naturally scopes pairings to a restaurant (a wine_list entry already belongs to a restaurant via `restaurant_id`).

### 4. Category filters are client-side

Distinct `beverage_type` values are fetched once on page load as part of the existing `GET /api/:slug/wine-list` payload. The filter is applied entirely in JS against the already-loaded `allEntries` array — no additional API endpoint needed, consistent with the current rack-filter pattern.

### 5. Cuisine server page is a separate HTML file

`public/cuisine/index.html` is a new standalone file mirroring the structure of `public/server/index.html`. The detail modal markup and logic will be duplicated rather than shared, consistent with the no-build-step constraint. Sharing via a JS module or server-side include would require a build tool or templating engine.

### 6. Logo upload follows existing image upload pattern

Logo images use the same Multer pipeline already in place for label/bottle images, stored under `/uploads/{slug}/logo.*`. The admin sends a multipart form; the server stores the path in `restaurants.logo_image_path`. A new `PUT /api/:slug/restaurant` endpoint handles restaurant-level updates (logo upload + any future restaurant metadata).

## Risks / Trade-offs

- **Breaking URL change** → Only Tannins Bar exists; communicate change before deploying. No automated redirect is added (would add complexity with no real benefit at this stage).
- **Duplicated modal code** → Cuisine and server pages share the detail modal pattern. If the modal needs changes later, it must be updated in two places. Acceptable given the no-build-step constraint.
- **Schema migration on live Render disk** → Running the updated `db-init.js` on production requires a Render one-off job. The `IF NOT EXISTS` / `ALTER TABLE IF NOT EXISTS` guards make this idempotent and safe.
- **Empty cuisine page UX** → Until a restaurant adds menu items and pairings, the cuisine page will show an empty state. This is expected and the page should communicate it clearly.

## Migration Plan

1. Deploy code changes (new routes, new pages, updated URLs)
2. Run `npm run db:init` as a Render one-off job to apply schema changes (new tables + new column)
3. Update any saved bookmarks or shared links to use the new `/{slug}/...` URL structure
4. (Optional) Upload restaurant logo via admin page after deploy

Rollback: revert the commit and redeploy. The new tables and column are additive; rolling back the code does not break existing data.

## Open Questions

- Should a `PUT /api/:slug/restaurant` route also allow updating the restaurant name or credentials, or should it be logo-only for now? *(Recommendation: logo-only for this change; keep auth credentials out of the API.)*
- Should menu item categories be free-text or a predefined enum? *(Recommendation: free-text — simpler, more flexible for varied restaurant menus.)*
