# Security findings

Severity is judged for this app as deployed: multi-tenant, public guest pages, no PII,
push-to-prod on `main`, no preview environment.

| ID | Severity | Finding | Status |
|---|---|---|---|
| [SEC-01](#sec-01) | **Critical** | Unauthenticated write: `PATCH /wine-list/:id/pairings/:pairingId` | verified |
| [SEC-02](#sec-02) | **High** | Cross-tenant delete: `DELETE /menu-items/:id/pairings/:pairingId` | verified |
| [SEC-03](#sec-03) | **High** | Remote crash / repeatable DoS — no error handling anywhere | verified |
| [SEC-04](#sec-04) | **High** | Stored XSS on public guest pages via the shared beverage catalog | verified in browser |
| [SEC-05](#sec-05) | **High** | Arbitrary HTML/JS upload served same-origin (MIME type is attacker-supplied) | verified |
| [SEC-06](#sec-06) | **Medium** | Authorization is per-verb at the mount point, so new routes are open by default | by inspection |
| [SEC-07](#sec-07) | **Medium** | No rate limiting or lockout on Basic Auth; credentials replayed on every request | by inspection |
| [SEC-08](#sec-08) | **Medium** | No security headers (no CSP, HSTS, `X-Frame-Options`, `nosniff`); `X-Powered-By` on | verified |
| [SEC-09](#sec-09) | **Low** | Cross-tenant data leak via unvalidated `rack_id` | verified |
| [SEC-10](#sec-10) | **Low** | 9 known-vulnerable dependencies incl. 1 critical; `xlsx` has no fix available | verified |
| [SEC-11](#sec-11) | **Low** | Any slug serves a live, branded page — no 404 for unknown tenants | verified |
| [SEC-12](#sec-12) | **Low** | Unvalidated theme colors; unbounded upload growth; no `Content-Disposition` | verified |

---

## SEC-01 — Unauthenticated write to any tenant's guest-facing content {#sec-01}

**Severity: Critical.** `src/app.js:42-45` gates the wine-list router by HTTP verb:

```js
app.use('/api/:slug/wine-list', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') return basicAuth(req, res, next);
  next();
}, wineListRouter);
```

`PATCH` is not in the list. `src/routes/wineList.js:121` is a `PATCH` route, and its first line
falls back to a slug lookup when `req.restaurant` is absent:

```js
const restaurantId = req.restaurant?.id || db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug)?.id;
```

So the route works perfectly well with no credentials at all. Anyone on the internet can
rewrite `house_pairing_text` for any pairing of any restaurant — the text servers read to
guests and the text shown in the cuisine modal.

**Reproduction** (no auth header sent):

```console
$ curl -X PATCH http://host/api/alpha/wine-list/1/pairings/1 \
    -H 'Content-Type: application/json' \
    -d '{"house_pairing_text":"PWNED by anonymous"}'
{"id":1,"house_pairing_text":"PWNED by anonymous"}   # HTTP 200
```

The value then appears on `/alpha/server` and `/alpha/cuisine` for every guest.

**Why it happened:** `PATCH …/pairings/:pairingId` is the newest route in the codebase
(added with per-pairing notes) and it is **not in the README's API table** — the table that
the app.js verb list mirrors. The doc and the gate drifted together.

**Fix.** Don't extend the verb list — that repeats the bug next time. Move authorization onto
the routes themselves, the way `src/routes/menuItems.js` already does it:

```js
// src/app.js — mount without a verb gate
app.use('/api/:slug/wine-list', wineListRouter);

// src/routes/wineList.js — each mutation names its own guard
router.patch('/:id/pairings/:pairingId', basicAuth, (req, res) => { … });
```

and delete the `req.restaurant?.id || <slug lookup>` fallback from every mutating route so a
missing `req.restaurant` fails closed instead of silently resolving the tenant. Add a
regression test that walks the route table and asserts every non-GET route has `basicAuth` in
its stack (see `remediation-plan.md` § "Make it not happen again").

---

## SEC-02 — Cross-tenant delete of another restaurant's pairings {#sec-02}

**Severity: High.** `src/routes/menuItems.js:127-134`:

```js
router.delete('/:id/pairings/:pairingId', basicAuth, (req, res) => {
  const existing = db.prepare(
    'SELECT id FROM menu_item_pairings WHERE id = ? AND menu_item_id = ?'
  ).get(req.params.pairingId, req.params.id);
  …
  db.prepare('DELETE FROM menu_item_pairings WHERE id = ?').run(req.params.pairingId);
```

This is the only route in the file that never resolves `restaurantId` and never scopes the
lookup to it. The `basicAuth` in front proves the caller owns *their own* slug — it says
nothing about who owns `:id` / `:pairingId`. Every sibling route in the same file gets this
right; this one was missed.

**Reproduction** — tenant `beta`, authenticating as itself, destroys `alpha`'s pairing:

```console
$ curl -u admin:beta123 -X DELETE http://host/api/beta/menu-items/1/pairings/1
{"id":1}                                    # HTTP 200 — menu item 1 belongs to alpha

$ curl http://host/api/alpha/menu-items/1/pairings
[]                                          # alpha's pairing is gone
```

IDs are small sequential integers, so enumerating a competitor's entire pairing set and
deleting it is a short loop. The AI-generated notes are not recoverable without re-running
`seed:pairings` (paid) and the wording differs on every run.

**Fix.** Scope it like the `PATCH` immediately above it:

```js
const restaurantId = req.restaurant.id;
const existing = db.prepare(
  `SELECT mip.id FROM menu_item_pairings mip
   JOIN menu_items mi ON mi.id = mip.menu_item_id
   WHERE mip.id = ? AND mip.menu_item_id = ? AND mi.restaurant_id = ?`
).get(req.params.pairingId, req.params.id, restaurantId);
```

**The general problem.** Tenant isolation here is a convention repeated by hand in ~20 query
sites. One omission is a cross-tenant breach and nothing catches it. See
`remediation-plan.md` § "Make it not happen again" for the chokepoint proposal.

---

## SEC-03 — One request crashes the process; there is no error handler {#sec-03}

**Severity: High.** The app has **no** `app.use((err, req, res, next) => …)` and no
`process.on('uncaughtException')`. Inside `src/routes/wineList.js`, the insert/update happen
inside multer's **asynchronous** callback, so a thrown `SqliteError` is not caught by
Express's synchronous handler — it reaches the event loop and kills the process.

**Reproduction:**

```console
$ curl -u admin:alpha123 -X POST http://host/api/alpha/wine-list -F beverage_id=99999
curl: (52) Empty reply from server

# server log:
SqliteError: FOREIGN KEY constraint failed
    at src/routes/wineList.js:88:8
    at done (node_modules/multer/lib/make-middleware.js:47:7)
…
Node.js v22.22.2          # process exited
```

Any authenticated tenant — or anyone who guesses one weak tenant password — can drop the
service for **all** tenants, repeatedly, with a one-line loop. Render restarts the container,
but restart + `db-init` is tens of seconds each time, and a loop keeps it down indefinitely.
During dinner service the guest pages are the product.

A related, non-fatal variant is unauthenticated (`SEC-01`'s route): sending
`{"house_pairing_text": 123}` throws `TypeError: house_pairing_text.trim is not a function`.
That one Express *does* catch, returning its default HTML error page — with a full stack trace
when `NODE_ENV` is not `production`.

**Fix**, in order:

1. Add a terminal error handler in `src/app.js` that logs server-side and returns
   `{ error: 'Internal error' }` — never the message or stack.
2. Wrap the DB work inside every multer callback in `try/catch` (or move it out of the
   callback), and map `SQLITE_CONSTRAINT_*` to `400`, not `500`.
3. Validate the FKs the caller supplies before inserting: `beverage_id` must exist;
   `rack_id`, if given, must belong to `req.restaurant.id` (this also fixes SEC-09).
4. Coerce/validate request-body types at the route boundary rather than calling `.trim()` on
   whatever arrived. A tiny hand-rolled validator is enough — this codebase does not need a
   schema library.
5. Add `process.on('uncaughtException')` / `('unhandledRejection')` that logs and exits
   deliberately, so an escape is at least diagnosable in Render's logs.

---

## SEC-04 — Stored XSS on public guest pages, injectable by any other tenant {#sec-04}

**Severity: High.** Two facts combine:

- `beverages` is a **global catalog shared by every tenant** (`docs/data-model.md`), and
  `POST /api/:slug/beverages` lets any authenticated tenant insert a row with an arbitrary
  `name`. The slug identifies the actor but the row is global and unattributed.
- Every page renders beverage/dish/rack text through `innerHTML` with **no escaping**.

Unescaped sinks (`${…}` interpolated straight into `innerHTML`):

| File | Lines | Field |
|---|---|---|
| `public/server/index.html` | 214, 239-249 | `beverage_name`, `beverage_type`, `rack_number` |
| `public/cuisine/index.html` | 192-201, 238-248 | `item.name`, `item.description`, `beverage_name`, `rack_number` |
| `public/admin/index.html` | 454, 645-655, 720-731, 878-885, 927, 963-970, 1003 | all of the above |
| `public/landing/index.html` | 68 | `data.name` inside an `alt="…"` attribute |

`public/server/index.html` *defines* an `escHtml` helper at line 286 and uses it in exactly
two places (339, 344) — the other sinks in the same file were never converted, and the admin
page has no escaping helper at all.

**Reproduction** — tenant `beta` poisons the shared catalog; the payload executes on tenant
`alpha`'s public, unauthenticated guest page (confirmed in headless Chromium):

```console
$ curl -u admin:beta123 -X POST http://host/api/beta/beverages \
    -H 'Content-Type: application/json' \
    -d '{"name":"<img src=x onerror=…>Chateau Evil","type":"Red"}'
{"id":3}

# alpha adds that catalog wine to its list (or an admin picks it from the shared dropdown)
# → loading http://host/alpha/server executes the payload:
PAYLOADS EXECUTED: ["XSS on localhost as tenant alpha"]
```

Note that no interaction from `alpha` is needed to reach the **admin** sink: the payload lands
in `/api/:slug/beverages?q=` search results, so it fires in any tenant's admin as soon as they
type a matching query, and it fires there with the admin's session in scope.

Combined with SEC-01 (unauthenticated writes) the injection does not even require a tenant
account: `house_pairing_text` is rendered through `mdToHtml`, which *does* escape — but
`rack_number` (SEC-09) and the wine-list fields do not.

**Impact:** defacement of a customer-branded page, a fake login prompt on a restaurant's own
domain, or silent modification of prices/pairings shown to guests.

**Fix.**

1. Escape at every sink. The lowest-churn version: move `escHtml` into `public/theme.js`,
   import it on all four pages, and wrap every interpolation. Better where it is cheap:
   build those rows with `createElement` + `textContent` (the code already does this for rack
   `<option>`s and filter chips).
2. Add a Content-Security-Policy (SEC-08). `script-src 'self'` would have neutered this
   payload class entirely. Note the inline `<script>` blocks in every page head — they need a
   hash or nonce, or to move into a file.
3. Sanitize on write as defence in depth: reject control characters and `<`/`>` in `name`,
   `type`, and `rack_number` in the POST handlers.
4. **Architectural:** reconsider letting any tenant write to a globally shared table. Either
   attribute catalog rows to their creator and only surface a tenant's own additions plus a
   curated set, or make catalog additions owner-moderated. `docs/architecture.md` already
   flags "correcting the canonical catalog is a separate, owner-only concern — not yet built";
   the write path shipped before that concern was resolved.

---

## SEC-05 — Arbitrary HTML/JS upload served from the app's own origin {#sec-05}

**Severity: High.** `src/routes/restaurant.js:35-42` and `src/routes/wineList.js:29-32` filter
uploads on `file.mimetype` — a value taken verbatim from the client's multipart headers — and
name the stored file with `path.extname(file.originalname)`, also client-controlled.
`src/app.js:20` then serves that directory with `express.static`, which sets `Content-Type`
from the extension.

**Reproduction:**

```console
$ printf '<script>alert(document.domain)</script>' > evil.html
$ curl -u admin:alpha123 -X PUT http://host/api/alpha/restaurant \
    -F "logo_image=@evil.html;type=image/png"
{"logo_image_path":"uploads/alpha/logo-1787703090523.html", …}

$ curl -i http://host/uploads/alpha/logo-1787703090523.html
HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8      # ← served as HTML, same origin
```

There is no path traversal (`path.extname` discards directory separators), so this is
"arbitrary file type", not "arbitrary path". That is still enough for stored XSS on the app's
origin and for hosting phishing content under the customer's own URL.

**Fix.**

1. Derive the extension from an **allow-list keyed off sniffed content**, not off the
   filename or the client's MIME header — read the magic bytes (JPEG `FF D8 FF`, PNG
   `89 50 4E 47`) and write `.jpg` / `.png` accordingly; reject anything else.
2. Serve uploads with `express.static(root, { setHeaders: res => { res.set('X-Content-Type-Options','nosniff'); res.set('Content-Security-Policy', "default-src 'none'"); } })`.
3. Long term, serving user uploads from a separate origin (or a signed CDN path) removes this
   class of bug outright.

---

## SEC-06 — Authorization by HTTP verb at the mount point {#sec-06}

**Severity: Medium** (the pattern; its two live instances are SEC-01 and SEC-02).

`src/app.js:27-48` gates three routers with `if (req.method === …) return basicAuth(...)`.
This is fail-open by construction:

- A route added with a verb not on the list is public (SEC-01 — `PATCH`).
- The gate cannot express per-route rules, so `menuItems.js` opts out of it entirely and
  applies `basicAuth` per route — meaning the codebase now has **two** auth conventions, and
  a reader has to check `app.js` *and* the router to know whether a route is protected.
- Routers then defensively re-resolve the tenant with `req.restaurant?.id || <slug lookup>`
  in 8 places. On a gated route that fallback is dead code; on an ungated one it is the
  vulnerability. It appears identical in both cases, which is why it reads as safe.

**Fix.** Standardize on per-route `basicAuth` (the `menuItems.js` style), delete the verb
gates, and delete every `req.restaurant?.id ||` fallback in a mutating handler so those
handlers read `req.restaurant.id` unconditionally and throw loudly if it is missing.

---

## SEC-07 — No brute-force protection on admin credentials {#sec-07}

**Severity: Medium.** `src/auth.js` has no rate limit, no lockout, no delay, and no logging of
failures. Passwords are per-tenant and human-chosen (`TENANT_PASS` at provisioning), the
username is `admin` for every tenant created by `create-tenant.js`, and the tenant list is
enumerable (any slug that returns real data from `GET /api/:slug/restaurant` is a live
tenant). bcrypt cost 10 is the only brake.

Two smaller issues in the same file:

- `restaurant.http_user !== username` (line 21) is a non-constant-time compare and returns
  **before** bcrypt runs, so a wrong username answers measurably faster than a wrong password
  — a username oracle. Minor, since the username is `admin` everywhere anyway.
- Basic Auth means the browser replays the credential on every single request, and there is
  no logout. Any XSS on an admin page (SEC-04) can read nothing directly, but any
  network-level exposure is total.

**Fix.** Add `express-rate-limit` (or 20 lines of in-memory counting — this is a
single-instance service) keyed on `slug + IP`: ~10 attempts / 15 min, then 429. Log failures
with the slug. Compare the username with `crypto.timingSafeEqual` after length-padding, and
run bcrypt even when the username is wrong so the timing is flat. Confirm Render is
force-redirecting HTTP→HTTPS.

---

## SEC-08 — No security headers {#sec-08}

**Severity: Medium.** Verified — the only header of interest on any response is
`X-Powered-By: Express`.

Missing: `Content-Security-Policy` (would have blocked SEC-04 and SEC-05),
`X-Content-Type-Options: nosniff`, `X-Frame-Options` / `frame-ancestors` (guest pages are
clickjackable — a fake "confirm your comp" overlay on a restaurant-branded page),
`Strict-Transport-Security`, `Referrer-Policy`.

**Fix.** `npm i helmet` and `app.use(helmet({ contentSecurityPolicy: { directives: { … } } }))`.
The CSP needs care because every page has an inline `<script>` for the pre-paint contrast
setting and inline `style="…"` attributes in the markup — either hash the inline scripts or
move them to files, and expect to allow `style-src 'unsafe-inline'` initially. Also
`app.disable('x-powered-by')`.

---

## SEC-09 — Cross-tenant leak via unvalidated `rack_id` {#sec-09}

**Severity: Low.** `POST`/`PUT /api/:slug/wine-list` accept `rack_id` and store it with no
check that the rack belongs to the caller. The read query then joins racks without a tenant
filter (`wineList.js:47` — `LEFT JOIN racks r ON r.id = wl.rack_id`), so another tenant's rack
label is rendered on a **public** endpoint.

```console
$ curl -u admin:beta123 -X POST http://host/api/beta/racks -d '{"rack_number":"BETA-SECRET-CELLAR-7"}'
$ curl -u admin:alpha123 -X PUT http://host/api/alpha/wine-list/1 -F rack_id=1
$ curl http://host/api/alpha/wine-list          # public, no auth
[("Test Red", "BETA-SECRET-CELLAR-7")]
```

Only rack labels leak, which is why this is Low. It is also a write-path integrity bug: the
foreign key is satisfied, so nothing complains.

**Fix.** Validate `rack_id` against `req.restaurant.id` on write (this is the same validation
that fixes the SEC-03 crash), and add `AND r.restaurant_id = wl.restaurant_id` to the join.

---

## SEC-10 — Vulnerable dependencies {#sec-10}

**Severity: Low** in practice, but one is critical-rated and one has no fix.

```
9 vulnerabilities (3 moderate, 5 high, 1 critical)

critical  tar        <=7.5.20   ← transitive: bcrypt → @mapbox/node-pre-gyp → tar
high      bcrypt     5.0.1-5.1.1
high      xlsx       *          ← prototype pollution + ReDoS, NO FIX AVAILABLE
high      brace-expansion, form-data
moderate  express 4.21.0-4.22.1, body-parser, qs
```

Also: **`multer` is pinned to `^1.4.5-lts.1`**, which is end-of-life and no longer receives
security fixes; 2.x is the supported line.

Assessment: `tar` and `brace-expansion` are build/install-time paths (`node-pre-gyp`) and are
not reachable from a request, so the critical rating overstates the runtime risk. `xlsx` is
the one that matters — it parses **untrusted-ish spreadsheet files** in `seed-import*.js`, and
there is no patched version on npm. `express` and `qs` are directly in the request path.

**Fix.**

1. `npm audit fix` for the moderate express/qs/body-parser chain — no breaking change.
2. `bcrypt@6` (major bump, drops the vulnerable `node-pre-gyp`/`tar` chain). API is
   unchanged for the two calls this repo makes; verify existing hashes still validate (they
   will — same bcrypt format).
3. `multer@2` — the diskStorage/fields API used here is compatible; test both upload routes.
4. `xlsx`: switch to the vendor-distributed build (`https://cdn.sheetjs.com/…`, which is
   patched but not on npm) **or** convert the two spreadsheets to CSV once and delete the
   dependency. The second option is attractive — `seed-menu.js` and `seed-beverages-csv.js`
   already parse CSV without any dependency, and the xlsx path is only needed because the wine
   sheet's section-header rows drive the type parser. That structure survives a CSV export.
5. Add `"engines": { "node": ">=22 <26" }` to `package.json` (see `code-quality.md` CQ-14).

---

## SEC-11 — Any slug serves a live branded page {#sec-11}

**Severity: Low.** `app.get('/:slug')` serves the landing page for *any* path segment;
`GET /does-not-exist` returns 200 with the Easily Paired branding. The page then fetches
`/api/<slug>/restaurant`, gets a 404, and silently keeps the defaults (`landing/index.html:70`
— `catch { /* silently keep defaults */ }`).

That makes `https://<prod-host>/anything-you-like` a working, brand-carrying page on the real
domain — handy for a phishing link that passes a domain check.

**Fix.** Look the slug up before serving any of the four page routes; 404 unknown tenants with
a real 404 page.

---

## SEC-12 — Input validation and storage hygiene {#sec-12}

**Severity: Low**, grouped.

- **Theme colors are unvalidated.** `PUT /api/:slug/restaurant` stores `theme_accent` /
  `theme_bg` as arbitrary strings; verified that `not-a-color; background:url(…)` persists.
  This is *not* CSS injection — `theme.js` applies them via
  `root.style.setProperty('--accent', accent)`, and the CSSOM rejects invalid values — but
  `hexToHsl` then produces `NaN` and every derived variable becomes `#NaNNaNNaN`, silently
  breaking the tenant's theme. **Fix:** validate `/^#[0-9a-f]{6}$/i` server-side, reject
  otherwise.
- **Uploads are never cleaned up.** Replacing a logo or a label image writes a new file and
  overwrites the DB path; the old file stays on the 10 GB Render disk forever, still publicly
  reachable at its old URL. **Fix:** unlink the previous path after a successful update, and
  add a `find /data/uploads -type f` reconciliation to the runbook.
- **`express.urlencoded({ extended: true })`** (`app.js:15`) is mounted but no route consumes
  a urlencoded body (everything is JSON or multipart). It is `qs`-backed and part of the
  moderate advisory above. **Fix:** delete it.
- **No body size limit is set** on `express.json()`; the 100 kB default applies, which is
  fine. Upload routes cap at 10 MB per file but `wineList` accepts two fields with unlimited
  file *counts* — `.fields([{name:'label_image'},{name:'bottle_image'}])` has no `maxCount`.
  **Fix:** `maxCount: 1` on both.
