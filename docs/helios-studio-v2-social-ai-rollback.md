# Packet 35: Social AI multi-variant rollback

October 3, 2026. Fresh live base `6d3089e8f8c7094457ffd2aa39c905412f888ecf` confirmed as merged Packet 34 / PR #341. Phase 1 remains open; production ON HOLD.

## Scope and required evidence

Extends the disposable Next/PostgreSQL harness to failure after partial work inside a two-variant generation transaction. The application and migrations are unchanged. The existing no-network provider fixture now supports an allowlisted FACEBOOK/INSTAGRAM set for both generation and grounding. Tests reject empty, duplicate and unsupported platform sets before any fixture database lock.

For each synthetic tenant, a disposable AFTER UPDATE trigger waits only when both variants of its test campaign have the generated caption inside the transaction. This observes later execution independently of variant iteration order. A separate transaction holds the corresponding advisory lock. Qualification requires observing the actual blocked SocialVariant query before cancelling only that backend query.

Required assertions:

- While blocked, an independent connection still sees the original variants and approval events.
- HTTP returns 502 after cancellation; both variant rows and approval events match their pre-request snapshots. Campaign status/purpose roll back while the existing failure handler records generation FAILED.
- The other tenant's campaign, variant and approval snapshots remain unchanged.
- After removing the injection, retrying the same request succeeds for both variants, increments each content version once, removes approvals and creates exactly one REVOKED event per variant.
- Completed replay changes nothing. No publication or publishing job is created.
- Trigger/function absence is checked before use and after removal. Finally drains the request and removes both objects. Existing schema/access postflight and earlier qualification cases remain required.

## Protected systems and limits

The trigger/function exist only in the fixed initially-empty disposable CI database. No Neon/staging/production database is accessed. No schema migration or application patch is made. Providers stay synthetic and have no network fallback; no provider credentials or deployment settings change. Rollback consists of reverting these harness/docs changes. The test database service is discarded at workflow completion.

This proves only the observed two-variant cancellation boundary and retry behavior after qualification. It does not prove arbitrary process-crash recovery, provider timeouts, source ownership changes while generation is pending, or tenant-scoped request-ID uniqueness. Hosted qualification and full Phase 1 exit remain open.

Twenty targeted local tests, TypeScript, scoped lint, syntax/whitespace and disposable source preparation pass. Exact-head regression/Chromium, runtime success and independently downloaded artifact inspection are required before integration; final evidence is recorded on the PR/checkpoint.
