# Remediation plan

Sequenced so each step is independently shippable. The constraint that shapes this plan:
**push to `main` deploys to prod with no preview environment**, so batch changes are riskier
than small ones, and anything touching auth needs a test before it ships, not after.

Back up prod before anything in Batch 1 lands:

```bash
cp /data/tannins.db /data/tannins.db.bak.$(date +%s)
```

---

## Batch 0 — before you push anything (½ day)

Do this first because every later batch is safer with it in place, and because it is the step
most likely to be skipped if left for later.

1. **`"engines": { "node": ">=22 <26" }`** in `package.json`.
2. **`test/api.test.js`** using `node:test` + `node:assert` — no new dependency. It should:
   - create a temp DB, run `db-init`, create two tenants (`alpha`, `beta`), start the app on
     an ephemeral port;
   - assert **every** mutating route 401s without credentials (SEC-01's regression test);
   - assert **every** mutating route 404s when tenant `beta` targets a row owned by `alpha`
     (SEC-02's regression test);
   - assert a bad `beverage_id` returns 400 **and the process is still alive** (SEC-03);
   - assert a `<script>`-bearing beverage name renders escaped (SEC-04).

   Drive the first two from a table of `[method, path]` so a newly added route that isn't in
   the table fails the test — that is the mechanism that stops SEC-01 recurring.
3. **`.github/workflows/ci.yml`** — `npm ci && npm test` on PRs to `main`.

## Batch 1 — the four incidents (1-2 days)

Ship as one PR; they're entangled and all four are live.

1. **SEC-01 + SEC-06 — move auth onto the routes.** Delete the three verb-gate middlewares in
   `src/app.js`; add `basicAuth` to each mutating route in `wineList.js` and `racks.js`
   (`menuItems.js` already does this); delete every `req.restaurant?.id || <slug lookup>`
   fallback from a mutating handler so a missing `req.restaurant` fails loudly. Keep the
   fallback only on the genuinely public GETs, where it should just be a plain slug lookup.
2. **SEC-02 — scope the pairing delete** in `menuItems.js:127` to `restaurant_id`, matching
   the `PATCH` handler right above it.
3. **SEC-03 — error handling.** Terminal error handler in `app.js` (log server-side, return
   `{error:'Internal error'}`, never a stack); `try/catch` around the DB work inside both
   multer callbacks; validate `beverage_id` exists and `rack_id` belongs to the caller before
   inserting (this also closes SEC-09); `process.on('uncaughtException'|'unhandledRejection')`
   that logs and exits deliberately.
4. **SEC-04 — escape output.** Move `escHtml` from `server/index.html` into `theme.js`,
   import it on all four pages, wrap every `${…}` that carries DB text. Fix `landing`'s
   `alt="${data.name}"`. Also reject `<` `>` and control characters server-side in
   `beverages.name`/`type` and `racks.rack_number`.

Verify each against the reproductions in `security.md` before pushing.

## Batch 2 — hardening (1 day)

5. **SEC-05** — sniff magic bytes to pick the stored extension; allow only `.jpg`/`.png`;
   add `nosniff` + a restrictive CSP header on the `/uploads` static mount; `maxCount: 1` on
   both upload fields.
6. **SEC-08** — `helmet` + `app.disable('x-powered-by')`. Budget real time for the CSP: every
   page has an inline `<script>` for the pre-paint contrast setting and inline `style=`
   attributes, so either hash the scripts or move them to files, and expect
   `style-src 'unsafe-inline'` at first.
7. **SEC-07** — rate-limit `basicAuth` per `slug + IP`, log failures, flatten the timing.
8. **SEC-11** — resolve the slug before serving any page route; real 404 for unknown tenants.
9. **SEC-12** — validate theme colors as `#rrggbb`; unlink superseded uploads; delete the
   unused `express.urlencoded`.

## Batch 3 — dependencies (½ day, then a decision)

10. `npm audit fix` (express/qs/body-parser — non-breaking).
11. `bcrypt@6` — verify existing hashes still validate (they will; same format) against a
    copy of the prod DB.
12. `multer@2` — test both upload routes.
13. **`xlsx` needs a decision.** No patched version exists on npm. Either pull the
    vendor-distributed build, or — better — export the two spreadsheets to CSV once and drop
    the dependency entirely. The section-header structure that drives the type parser
    survives a CSV export, and `seed-menu.js` already proves CSV parsing needs no dependency
    here. That deletes an unfixable high-severity advisory and a 1 MB dependency.

## Batch 4 — cleanup (1 day, no behaviour change)

14. Delete: `scripts/seed-import.js` (CQ-01/02), `scripts/seed-enrich.js` (CQ-05), the no-op
    UPDATE in `db-init.js` (CQ-03), the `restart` npm script (CQ-15), `.claude/commands/opsx/`
    and `.claude/skills/openspec-*/` (CQ-16), the unused `hexToHsl`/`hslToHex` imports (CQ-06).
15. Stop reading and writing `general_pairing` / `house_pairing` (CQ-04).
16. `scripts/lib/db-path.js` — one `resolveDbPath()` used by `src/db.js` and every script.
    This deletes the ⚠️ from the runbook instead of documenting it (CQ-07).
17. Share the multer plumbing and `parseCsv` (CQ-07). Move `mdToHtml`/`setText`/`fmt$` into
    `theme.js` alongside `escHtml`. **Stop there** — no component layer, no build step.
18. Add the `CREATE INDEX IF NOT EXISTS` block to `db-init.js` (CQ-08).
19. Fix the docs: README seeding section and env table, add the PATCH rows to the API table,
    the self-contradicting paragraph in `data-model.md`, and Pariz→Pairz (CQ-11/12).

## Batch 5 — deliberate decisions (schedule separately)

These need a product call, not just a patch.

- **CQ-09** — `UNIQUE` on `beverages(name)`. Check prod for existing duplicates first; the
  constraint requires a table rebuild in SQLite, so it needs a maintenance window.
- **CQ-10** — explicit `ON DELETE` clauses. New databases pick them up from the `CREATE
  TABLE`; prod keeps the old behaviour until a rebuild. Decide whether a tenant-delete path
  should exist at all.
- **CQ-13** — is this a PWA or not? Either add icons + a service worker + a working
  `start_url`, or stop calling it one in the docs.
- **SEC-04, architectural** — should any tenant be able to write to the globally shared
  `beverages` table? `docs/architecture.md` already flags owner-moderated catalog correction
  as "not yet built"; the write path shipped ahead of it. Options: attribute catalog rows to
  their creator and only surface a tenant's own additions plus a curated set, or make
  additions a moderation queue.
- **CQ-17** — bump `@anthropic-ai/sdk`, lift the model ID to one constant, and stop indexing
  `content[0]`.

---

## Make it not happen again

Three of the four critical findings are instances of the same two patterns. Fixing the
instances without fixing the patterns buys you a year.

**Authorization must be visible at the route.** Right now you have to read `src/app.js` *and*
the router to know whether a route is protected, and a route with an unlisted verb is public.
After Batch 1 every route carries its own guard, and the Batch 0 route-table test fails if a
new one doesn't. That is the whole fix — no framework needed.

**Tenant scoping needs a chokepoint.** `AND restaurant_id = ?` is currently hand-repeated at
~20 query sites; one omission (SEC-02) is a cross-tenant breach and nothing catches it. Two
options, in increasing order of effort:

- *Cheap:* a small `src/db-scoped.js` with helpers like
  `getOwned(table, id, restaurantId)` / `deleteOwned(table, id, restaurantId)` that every
  handler uses instead of raw `db.prepare`. Omitting the scope becomes a missing argument
  rather than a missing SQL clause.
- *Thorough:* the paired-route test from Batch 0, kept as a permanent invariant — for every
  mutating route, tenant B must get a 404 acting on tenant A's row.

Do the test either way; do the helper if you touch those files anyway during Batch 4.

**Keep the README API table honest.** SEC-01 exists because a route was added to the code and
not to the table, and the table is what the verb list mirrored. `CLAUDE.md` already says docs
must be updated in the same change — the table is the highest-leverage instance of that rule.
