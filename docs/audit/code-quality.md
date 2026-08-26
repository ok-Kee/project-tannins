# Code quality — dead code, duplication, and drift

Ordered roughly by how much they cost you, not by size of diff.

| ID | Finding |
|---|---|
| [CQ-01](#cq-01) | `scripts/seed-import.js` is broken — it reads a file that isn't in the repo |
| [CQ-02](#cq-02) | Dead code inside `seed-import.js`: an unused function and abandoned first-draft variables |
| [CQ-03](#cq-03) | `db-init.js` contains a no-op UPDATE with a comment describing something else |
| [CQ-04](#cq-04) | Retired-but-live columns: `general_pairing`, `house_pairing` |
| [CQ-05](#cq-05) | `seed-enrich.js` is documented as retired but is still in the tree and still runnable |
| [CQ-06](#cq-06) | Unused imports on all four pages |
| [CQ-07](#cq-07) | Duplication: upload plumbing, CSV parser, xlsx parser, and ~120 lines of page JS |
| [CQ-08](#cq-08) | No database indexes; every list query is a full table scan |
| [CQ-09](#cq-09) | `beverages.name` is treated as unique but isn't constrained; check-then-insert race |
| [CQ-10](#cq-10) | Missing `ON DELETE` behaviour leaves orphans; deleting a rack breaks its wines |
| [CQ-11](#cq-11) | Doc drift: README seeding section, missing PATCH routes, "Pariz" vs "Pairz" |
| [CQ-12](#cq-12) | `docs/data-model.md` contradicts itself about the retired pairing fields |
| [CQ-13](#cq-13) | The PWA is not a PWA: no service worker, no icons, `start_url` 404s |
| [CQ-14](#cq-14) | No tests, no linter, no CI, no `engines` — on a repo that deploys on push |
| [CQ-15](#cq-15) | `npm run restart` kills whatever owns port 3000 |
| [CQ-16](#cq-16) | Retired `openspec` tooling still in `.claude/` |
| [CQ-17](#cq-17) | Anthropic SDK usage is fragile and the SDK pin is old |
| [CQ-18](#cq-18) | Silent error swallowing in the frontend |

---

## CQ-01 — `seed-import.js` cannot run {#cq-01}

`scripts/seed-import.js:12` reads `path.join(__dirname, '../Tannins Bar Wine 2026.xlsx')`.
That file is not in the repo and is not gitignored — it was never committed. The script is
still wired to `npm run seed:import` and still advertised in the README's "Seeding a
restaurant" section as step 1.

It also hardcodes the sheet name `'MPS WINE LIST'` while targeting the `tannins-bar` tenant —
"MPS" is Mountain Prime's sheet, so this is a copy/paste from the newer `seed-import-mps.js`
back into the older script.

**Action:** delete `scripts/seed-import.js` and its npm script. `seed-import-mps.js` is the
working, better-documented version and already parameterizes the path and sheet name via env
vars; if `tannins-bar` ever needs re-importing, generalize *that* one (its slug/name/title
constants are the only tenant-specific parts). Deleting it also removes one of the two
copies of the section parser (CQ-07) and one `DB_PATH`-only script from the runbook's gotcha
list.

---

## CQ-02 — Dead code inside `seed-import.js` {#cq-02}

If it is kept rather than deleted:

- `isHeaderRow()` (line 39) is defined and never called anywhere in the repo.
- Lines 108-109 compute `priceBtg` / `priceBtl` with a triple-nested ternary that is then
  discarded — lines 111-112 recompute the same thing as `finalPriceBtg` / `finalPriceBtl`
  under a comment literally reading `// Simpler:`. The first draft was left in place next to
  its replacement.
- `col1` is destructured and unused (`seed-import-mps.js` fixed this with a hole in the
  destructuring; the older file didn't).

These are the clearest "generated, superseded, never cleaned" markers in the codebase.

---

## CQ-03 — No-op migration in `db-init.js` {#cq-03}

`scripts/db-init.js:132-136`:

```js
// Rename tannins-bar slug to tannins-bar if still present
db.prepare(`
  UPDATE restaurants SET slug = 'tannins-bar', name = 'Tannins Bar'
  WHERE slug = 'tannins-bar'
`).run();
```

The comment says "rename X to X"; the statement sets a row to the values it already matched
on. This ran on every boot of every deploy. Presumably the original slug was scrubbed from
both the comment and the SQL during a rename, leaving the shape behind.

**Action:** delete it. While in the file, also move the `tannins-bar` default-theme seed
(lines 138-142) out of the schema migration — a migration script that hardcodes one tenant's
brand colors will surprise whoever adds tenant #3.

---

## CQ-04 — Retired columns still read and written {#cq-04}

`docs/data-model.md` says `general_pairing` is "**retired** … no longer written or surfaced"
and that `wine_list.house_pairing` remains only for back-compat. In the code:

- `general_pairing` is still `SELECT`ed in `routes/beverages.js:8` and twice in
  `routes/wineList.js` (44, 60) — shipped to every client on every list load, and never
  rendered.
- `house_pairing` is still destructured from the request body and written in both the
  `POST` and `PUT` handlers of `wineList.js` (79, 86-88, 175, 186, 195). No frontend sends
  it — but `POST /api/:slug/wine-list` will happily accept and store it from anyone with a
  tenant credential.
- All three importers still write `general_pairing` explicitly as `NULL` in their INSERT.

**Action:** drop the columns from the SELECTs and the write paths now (cheap, no data loss),
and decide separately whether to actually drop the columns. SQLite supports
`ALTER TABLE … DROP COLUMN` as of 3.35; `better-sqlite3` v11 bundles a newer one. If you keep
them, say so in the schema with a comment rather than only in the docs.

---

## CQ-05 — `seed-enrich.js` is retired but still runnable {#cq-05}

The runbook says: "The script file remains but is no longer wired to an npm task and should
not be run." It is still in `scripts/`, still writes the retired `general_pairing` column,
still honors only `DB_PATH` (so on Render it silently writes to an ephemeral
`./db/tannins.db`), and still costs API tokens if someone runs it.

The README, meanwhile, still tells you to run it (CQ-11).

**Action:** delete the file. Git history is the archive. If it must stay, add a guard at the
top that exits with the deprecation message.

---

## CQ-06 — Unused imports {#cq-06}

All four pages import `hexToHsl` and `hslToHex` from `theme.js` and use neither — they are
internal helpers of `applyTheme`. Verified: the identifiers appear exactly once per file, on
the import line.

```
public/admin/index.html:238    public/server/index.html:87
public/cuisine/index.html:69   public/landing/index.html:49
```

**Action:** trim to `import { applyTheme, initContrastToggle } from '/public/theme.js'`. Then
add `escHtml` to `theme.js` and import *that* instead (SEC-04).

---

## CQ-07 — Duplication {#cq-07}

| Duplicated | Where | Lines |
|---|---|---|
| `getUploadDir` + `IMAGE_TYPES` + multer `diskStorage` + `fileFilter` | `routes/restaurant.js:9-42`, `routes/wineList.js:8-32` | ~30, near-identical |
| `parseCsv` (hand-rolled, byte-for-byte identical) | `seed-menu.js:28-53`, `seed-beverages-csv.js:32-57` | 26 each |
| `SECTION_TYPE_MAP` + `getSectionType` | `seed-import.js:19-37`, `seed-import-mps.js:34-52` | 19 each |
| `mdToHtml`, `setText`, `fmt$`, `$`, the whole modal | `public/server/index.html`, `public/cuisine/index.html` | ~120 |
| DB-path resolution (`DB_PATH \|\| DATA_DIR \|\| ./db`) | `src/db.js` + 5 scripts, with 2 scripts doing it *differently* | 5 each |

The last one is the expensive one — it's the reason the runbook carries a ⚠️ warning about
which scripts honor `DATA_DIR`, and the reason a prod seed run can silently write to a
throwaway file. **Action:** one `scripts/lib/db-path.js` exporting `resolveDbPath()`, used by
`src/db.js` and every script. That deletes the ⚠️ from the runbook rather than documenting it.

The page-JS duplication is the one to *not* over-fix: `CLAUDE.md` is explicit that there is no
build step and pages are self-contained. Moving `mdToHtml` / `setText` / `escHtml` / `fmt$`
into `theme.js` (already an ES module every page imports) is in keeping with that; introducing
a component layer is not.

The multer plumbing and `parseCsv` should just be shared modules — no design tension there.

---

## CQ-08 — No indexes {#cq-08}

`db-init.js` creates six tables and zero indexes. Every query in the app filters on a foreign
key or on `beverages.name`:

```sql
CREATE INDEX IF NOT EXISTS idx_wine_list_restaurant   ON wine_list(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_wine_list_beverage     ON wine_list(beverage_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant  ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_racks_restaurant       ON racks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_mip_menu_item          ON menu_item_pairings(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_mip_wine_list          ON menu_item_pairings(wine_list_id);
CREATE INDEX IF NOT EXISTS idx_beverages_name         ON beverages(name);
```

At ~90 wines/tenant this is invisible. It stops being invisible when the shared `beverages`
catalog accumulates every tenant's list and `GET /api/:slug/beverages?q=` — which runs on
every keystroke in two search boxes — does a `LIKE '%…%'` scan of the whole table. (A leading
wildcard defeats a plain index too; if search gets slow, FTS5 is the answer, but the FK
indexes above are worth adding regardless.)

**Action:** append the `CREATE INDEX IF NOT EXISTS` block to `db-init.js`. It is idempotent
and applies on the next boot, exactly like the guarded ALTERs.

---

## CQ-09 — `beverages.name` is assumed unique but isn't {#cq-09}

Four places treat the catalog as keyed by name — `routes/beverages.js:16` (check-then-insert),
all three importers (`findBeverage.get(name)`), and `gen-port-phase2.js`, whose entire porting
strategy is "match prod rows by beverage name". `gen-port-phase2.js:58-59` even comments
"names are unique (vintage+producer)".

But there is no `UNIQUE` constraint. Consequences:

- Two concurrent `POST /api/:slug/beverages` with the same name both pass the existence check
  and both insert. Unlikely at this traffic, but free to prevent.
- The port script's `UPDATE … WHERE f.name = beverages.name` would apply one tenant's flavor
  profile to a duplicate row, and its `JOIN … ON b.name = p.bev` would fan out pairings.
- Nothing tells you when the invariant is already broken in prod.

**Action:** check prod for existing duplicates first
(`SELECT name, COUNT(*) FROM beverages GROUP BY name HAVING COUNT(*) > 1`), resolve any, then
add `UNIQUE` on `beverages(name)` — via the recreate-and-copy dance SQLite requires, guarded
in `db-init.js` — and change the POST handler to `INSERT … ON CONFLICT DO NOTHING` +
`RETURNING`, which removes the race entirely.

---

## CQ-10 — Referential integrity gaps {#cq-10}

`foreign_keys = ON` is set, and `menu_item_pairings` correctly cascades. The rest do not
declare any `ON DELETE` behaviour, so they default to `NO ACTION`:

- `wine_list.rack_id REFERENCES racks(id)` — deleting a rack is **blocked** by the FK if any
  wine points at it. There is no rack-delete endpoint today, so nobody has hit this; the
  moment one is added it will fail confusingly. Should be `ON DELETE SET NULL`.
- `wine_list.restaurant_id`, `racks.restaurant_id`, `menu_items.restaurant_id` — deleting a
  tenant is blocked. Arguably correct (safety), but it should be a deliberate choice, and
  there is currently no tenant-offboarding path at all.
- `wine_list.beverage_id REFERENCES beverages(id)` — this is the one that produced the SEC-03
  crash, because the FK failure surfaces as an uncaught exception rather than a 400.

**Action:** add explicit `ON DELETE` clauses to the `CREATE TABLE`s (they apply to new
databases), and note in `docs/data-model.md` that existing prod tables keep the old behaviour
until a table rebuild — SQLite cannot alter a constraint in place.

---

## CQ-11 — Doc drift {#cq-11}

- **README "Seeding a restaurant"** presents `npm run seed:import` + `npm run seed:enrich` as
  *the* two-script flow. `seed:enrich` has no npm script (it was removed from `package.json`),
  the runbook says it is retired and must not be run, and `seed:import` is broken (CQ-01).
  Following the README as written fails on step 1 and fails again on step 2.
- **README env table** lists `ANTHROPIC_API_KEY` as "Used by `seed:enrich`" — should be
  `seed:flavor` / `seed:pairings`.
- **README API table** is missing both `PATCH …/pairings/:pairingId` routes. This is the
  same omission that produced SEC-01 — the table and `app.js`'s verb list mirror each other,
  so a route missing from one tends to be missing from the other.
- **`Pariz LLC` vs `Pairz LLC`.** `CLAUDE.md` and the rendered footer in
  `public/landing/index.html:46` say **Pairz**. `docs/architecture.md` ("© Pariz LLC") and
  `docs/runbook.md` ("company **Pariz LLC**") say **Pariz**. One of these is the legal entity
  name; worth getting right in the docs, since the footer is customer-facing.

**Action:** rewrite the README seeding section against the runbook's table (which is
accurate), add the PATCH rows to the API table, fix the company name in `docs/`.

---

## CQ-12 — `docs/data-model.md` contradicts itself {#cq-12}

The "Menu pairings" section correctly states that the global General/House Pairing textareas
were removed from admin and that pairing text now lives per-pairing. Then, ~40 lines later,
under **Display rule**:

> **Admin:** the shared field shows read-only … with its editable override directly beneath
> it — General Pairing → House Pairing, Flavor Profile → House Flavor Profile.

That paragraph describes the UI as it was *before* the change described above it, in the same
file. A reader following the doc top-to-bottom gets the right answer; one who greps for
"Admin:" gets the wrong one.

**Action:** delete the stale half-sentence, keeping the Flavor Profile part (which is still
true).

---

## CQ-13 — The PWA is not installable {#cq-13}

`public/manifest.json`:

```json
{ "name": "Easily Paired", "start_url": "/", "display": "standalone", "icons": [] }
```

- `"icons": []` — an empty icon array fails the installability criteria in Chrome; there is no
  home-screen icon and no install prompt.
- `"start_url": "/"` — verified to return **404**. `src/app.js` has no `/` route; the
  shallowest route is `/:slug`. An installed app would launch to an error page.
- There is no service worker anywhere in the repo, so there is no offline capability and no
  caching — which is the main thing a floor-facing tablet app on restaurant wifi would want.

README and `docs/architecture.md` both describe the frontend as a "PWA". Right now it is a
responsive web page with a manifest file.

**Action:** decide which you want. If PWA is real: add icons, make `start_url` tenant-aware
(the manifest has to be served per-tenant, or `start_url` set to `.` so it resolves relative
to the page), and add a service worker that caches the app shell and the last wine-list
response. If it isn't a priority, say "responsive web app" in the docs and either fix
`start_url` to a real path or drop the manifest — a broken manifest is worse than none.

---

## CQ-14 — No tests, no linter, no CI, no engine pin {#cq-14}

On a repo where **push to `main` deploys straight to production with no preview
environment**, there is:

- no test of any kind (no framework, no test script, no fixtures);
- no linter or formatter config;
- no CI workflow (`.github/` does not exist);
- no `engines` field, despite `CLAUDE.md` and the runbook both warning that
  `better-sqlite3` v11 will not build on Node 26 and that Node 22 LTS is required.

Every one of the four critical findings in `security.md` would have been caught by a modest
test file. **Action** — highest value per line of code in this whole audit:

1. `"engines": { "node": ">=22 <26" }` in `package.json`. Free, and it turns a confusing
   native-build failure into a clear message.
2. A `test/api.test.js` using `node:test` + `node:assert` (both built in — no new
   dependency, consistent with the no-build-step ethos) that spins the app against a temp DB
   with two tenants and asserts: every mutating route rejects an anonymous request; every
   mutating route rejects tenant B acting on tenant A's row; a bad FK returns 400 and the
   process survives; a `<script>` beverage name comes back escaped in the rendered page.
3. A GitHub Actions workflow running `npm ci && npm test` on PRs to `main`.

---

## CQ-15 — `npm run restart` {#cq-15}

```json
"restart": "fuser -k 3000/tcp 2>/dev/null; node src/app.js"
```

Kills whatever process owns port 3000 — not necessarily this app — then starts. It also
ignores `PORT`, so it does the wrong thing for anyone running on a different port. This is a
personal shell alias that ended up in `package.json`.

**Action:** delete it, or move it to a `Makefile`/local script that isn't shipped.

---

## CQ-16 — Retired tooling in `.claude/` {#cq-16}

`CLAUDE.md` states the `docs/` files "replace the old `openspec/` workflow". The workflow's
tooling is still checked in: `.claude/commands/opsx/{apply,archive,explore,propose}.md` and
`.claude/skills/openspec-*/SKILL.md`. There is no `openspec/` directory for them to operate
on.

**Action:** delete both directories.

---

## CQ-17 — Anthropic SDK usage {#cq-17}

The model ID in `seed-enrich.js`, `seed-flavor.js`, and `seed-pairings.js` is
`claude-sonnet-4-6` — a valid, current model, so nothing is broken. Three notes:

- **`@anthropic-ai/sdk` is pinned to `^0.39.0`**, which is well behind. Worth bumping when
  you next touch these scripts.
- **`message.content[0].text` is assumed** in all three scripts. That works today but breaks
  the moment thinking is enabled or the model returns a non-text first block. Find the first
  block with `type === 'text'` instead of indexing `[0]`, and check `stop_reason` — a
  `refusal` currently throws a confusing `TypeError` inside the per-beverage catch and gets
  logged as if it were a transient failure.
- **The model ID is hardcoded in three files.** Lift it to one constant (or
  `process.env.PAIRING_MODEL`) so a model change is one edit.

`seed-pairings.js` is otherwise the best-written script in the repo — it validates the model's
JSON against a known-ID set before inserting, which is exactly right.

---

## CQ-18 — Silent error swallowing in the frontend {#cq-18}

Several `catch` blocks discard the error with no user-visible signal:

- `landing/index.html:70` — `catch (e) { // silently keep defaults }`. A 404 slug looks
  identical to a working one (SEC-11).
- `admin/index.html` `loadLogo()` — `catch (e) { /* silent */ }`.
- Every `fetch` in `server/index.html` and `cuisine/index.html` `init()` is unguarded: if the
  API 500s, `await res.json()` throws and the page stays stuck on "Loading…" forever with a
  console error nobody on the floor will see.

For a tool used mid-service on a tablet, "stuck on Loading…" is the worst failure mode — the
server can't tell whether it's slow wifi or a broken app.

**Action:** render an explicit error state with a retry button in the three `init()` paths.
Keep the silent-default behaviour on the landing page only if unknown slugs start returning a
real 404 (SEC-11).
