# Packet 77: consented support diagnostics

Status: implementation candidate; published-head gates are required before integration. Phase 1 remains OPEN. Production ON HOLD.

## Authority and scope

Implements the [approved October 7 policy](helios-studio-v2-support-access-decision.md), integrated in PR #384 at `c73a3c52841c278c2f1be926d7a9afb2840aac51`. The previous qualified implementation packet is Packet 76 / PR #383 at `4e34a90829be30f58ecce0567b6c1c56c1d706d7`: 1,804 tests, TypeScript, Chromium and independently verified runtime artifact 11486141442, SHA256 `02e1349d8faa237b386c0dd36d60ffe2907a891655d788e113e58dfac70c37c0`.

Adds an initially empty operator registry and consent grants. No user is enrolled by migration. Both tenant mode and `STUDIO_V2_SUPPORT_DIAGNOSTICS_ENABLED=true` are required; disabled routes return 404. Real enrollment and production activation remain separate owner actions. Qualification enables only a disposable synthetic runtime.

`POST /api/admin/support-grants` requires a current target OWNER, separately enrolled active named operator, different issuer/operator, nonblank reason (maximum 600 characters), exact DIAGNOSTICS scope and integer duration 1–30 minutes. Target comes exclusively from the current authenticated tenant. `DELETE` on that endpoint allows a current target OWNER to revoke a grant. No list, renewal, enrollment or impersonation endpoint is added.

`GET /api/platform/support/diagnostics?grantId=…` retains the authenticated operator's home session and independently resolves the consented target. It checks current account/session/home membership, enabled platform registry, current issuing OWNER and grant state. It returns only `workspaceId`, fixed `scope`, `countLimit: 10000`, and bounded owned `projects`/`activeMemberships` counts. No content, names, email addresses, media URLs, provider responses or credentials are selected for the diagnostic projection. Responses use private/no-store caching. Other HTTP methods cannot mutate through this endpoint; a grant never changes ordinary tenant session authority.

## Transactions and audit

All support operations lock the target Workspace first. Creation/read lock involved AdminUser IDs in sorted order; membership and grant rows remain locked through authorization and work. Revocation follows the existing Workspace/account/membership order. Cross-workspace operations do not acquire a second Workspace lock. Read hints choose lock identities only and are compared again with the locked grant.

Database time defines creation/expiry. Expiry is checked again after writing the required read audit. An allowed response is returned only after the transaction commits. Audit failure rolls back consent/revocation and returns no diagnostics. Successful events record actor, workspace, operator, issuer, scope, request ID, outcome and grant ID as the persisted reason reference. Denied requests make a separate bounded audit attempt against the actor's home workspace without discovering target content; failed denial auditing does not permit access. Raw errors/reasons are not returned.

## Required evidence

Targeted tests exercise default-off gates, invalid consent, malformed persisted grants, exact projection, expiry during audit, audit failure and additive migration/FK safety. The isolated real HTTP/PostgreSQL harness applies the checked-in migration to empty new tables and compares columns/indexes/constraints with Prisma's declaration. Both tenant directions cover role escalation, absent/disabled enrollment, self-grants, wrong operator, spoofed target, invalid scope/duration/reason, revocation, audit-failure rollback and concurrent reciprocal reads/grants. Twenty database-observed waits revoke operator/issuer/grant authority after initial authentication, including grant creation and revocation by a demoted OWNER. Business project rows and global schema/access postflight must remain unchanged.

Full regression, TypeScript, Chromium, exact-head isolated qualification, independently downloaded/hashed/parsed evidence and merge-tree equality remain mandatory. This packet does not close workspace lifecycle, general impersonation, hosted/CDN parity, other unqualified content/job/AI/analytics families, or the final Helios/second-company compatibility verdict. No production migration is performed.
