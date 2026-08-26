# Security & Code Audit — 2026-08-26

Full audit of `project-tannins` (Easily Paired) at commit `02e383a`. Covers the Express API,
the vanilla-JS frontend, the seed/migration scripts, dependencies, and the docs.

## Files

| File | Contents |
|---|---|
| [`security.md`](security.md) | 12 security findings, each with a reproduction and a recommended fix |
| [`code-quality.md`](code-quality.md) | Dead code, duplication, schema gaps, doc drift, missing infrastructure |
| [`remediation-plan.md`](remediation-plan.md) | Sequenced plan — what to ship first and why |

## How this was verified

Findings marked **verified** were reproduced against a local instance (two tenants, `alpha`
and `beta`, on a throwaway SQLite file), not just read out of the source. The stored-XSS
finding was confirmed executing in headless Chromium. Findings marked **by inspection** are
read from the code and are not exploitable on their own, or were not worth standing up a
harness for.

## Headline

Four issues are worth treating as incidents rather than backlog items, because the app is
live, multi-tenant, and deploys straight to prod on push to `main`:

1. **[SEC-01] An unauthenticated stranger can rewrite any restaurant's guest-facing pairing
   notes.** One route was never added to the auth list. *(verified)*
2. **[SEC-02] Any tenant can silently delete any other tenant's pairings.** *(verified)*
3. **[SEC-03] Any tenant can crash the whole service with one malformed request,
   repeatedly.** There is no error handler anywhere in the app. *(verified)*
4. **[SEC-04] Any tenant can plant JavaScript that executes on every other tenant's public
   guest pages** via the shared beverage catalog. *(verified in a browser)*

The common root cause for 1, 2 and 4 is not carelessness in any single line — it's that
authorization is expressed **per HTTP verb in a mount-point middleware** rather than
per-route, and that tenant isolation is enforced by convention (remembering to add
`AND restaurant_id = ?`) rather than by a chokepoint. Any route added later is open by
default. The remediation plan addresses the pattern, not just the three instances.

## Scope notes

- No authenticated-user data, payment data, or PII is stored — the blast radius is
  wine lists, menus, prices, and pairing copy. That lowers severity but does not remove it:
  SEC-04 is a foothold for defacement and credential phishing on a customer-branded page,
  and SEC-03 is a trivially repeatable outage during dinner service.
- The `openspec/` workflow referenced in the repo's `.claude/` directory is retired per
  `CLAUDE.md`; that tooling is listed as an artifact in `code-quality.md`, not a risk.
