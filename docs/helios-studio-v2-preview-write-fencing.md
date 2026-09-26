# Packet 21: transaction-time preview mutation authority

September 26, 2026. Production ON HOLD.

## Reproduced problem

The preview POST/DELETE handlers previously trusted the membership snapshot returned by `getAdminSession` before the database write. POST awaited request input and a project transaction without rechecking membership; DELETE updated the preview directly. A deterministic isolated execution of the original POST with membership revoked after session resolution returned 201 and created a preview. This reproduction used adapted dependencies, not a live customer or staging request.

## Bounded correction

Both mutations now call the existing `requireLockedWorkspaceEditor` helper inside their write transaction, before locking the owned project. This preserves the established Workspace → AdminUser → WorkspaceMembership → Project order and rechecks active account, stored workspace, session version and current membership role/status. DELETE performs its scoped update inside the same transaction. Fresh authorization failure returns 403. Missing/foreign project behavior remains 404.

No schema, token format, preview expiry, domain selection, read/validation logic or provider behavior changes. Audit recording keeps its existing best-effort behavior; this packet does not claim transactional audit guarantees or atomic revocation of already-authorized preview reads.

## Verification

Six new regression cases run the actual route and actual locked authorization helper with controlled current database state: revoked membership, VIEWER role, session-version change, disabled user, workspace transfer and lookup failure. POST/DELETE must reject with no mutation/audit. Existing preview ownership tests remain intact, using the updated transactional write interface. Local targeted tests: 11 passed; non-incremental TypeScript/scoped lint/whitespace passed.

The real Next/PostgreSQL harness additionally holds the workspace/project/preview rows, starts an actual HTTP mutation, and observes its blocked database backend with `pg_blocking_pids`. Only then does the holding transaction revoke membership and commit. Both POST and DELETE, in both tenants, must resume with 403 and unchanged preview/audit rows. This tests revocation between initial session resolution and write admission without relying on a timing delay alone. The request drains before fixture access is restored, even on failure.

The full Packet 19/20 HTTP qualification runs before these four lock scenarios. Exact-head CI and downloaded receipt inspection are required before runtime success is claimed.

## Verified preceding packet

Packet 20 PR #327 passed runtime `36251029160` and regression `36251029159` at `e42a2c54d3db372c403d01a227421be9e385ca86`, merged only into the non-production base at `752802d937dac5d89bf64772ca74c93e549f23f3`. Downloaded artifact `10909805079` archive SHA256 independently verified: `d6ccdf80bc19a9092d3d72245e883d8522a105c6d91d0d17662016f8bad29dc5`. Candidate and both-direction published/draft/preview, creation/revocation/expiry, rejected usage-write and prior postflight evidence inspected.

Phase 1 remains open for other paths and hosted qualification. This is not a production release.
