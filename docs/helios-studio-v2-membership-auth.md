# Phase 1 membership authorization

The session and workspace helpers now share a server-only membership lookup. With STUDIO_V2_TENANT_CONTEXT_ENABLED=false, they do not query the membership table. With the flag enabled, only an ACTIVE membership matching both the database-backed user and compatibility workspace grants access. Membership role overrides the legacy role. Missing records, revoked access and database failures never fall back to legacy permissions.

Lifecycle writes now run in the same transaction as invitation acceptance, initial owner creation, explicit access changes and ownership transfer. Existing users are never upserted into active membership during login. Login checks membership access before issuing a session when tenant context is enabled. Role-only changes preserve membership status; profile and password edits do not change membership access. Explicit activation changes synchronize ACTIVE/SUSPENDED. Invitation acceptance conditionally claims an unexpired, unrevoked invitation to prevent duplicate consumption.

## Remaining activation gates

Keep both flags disabled in production. After the additive migration, STUDIO_V2_MEMBERSHIP_WRITES_ENABLED can enable compatibility writes before membership reads. STUDIO_V2_TENANT_CONTEXT_ENABLED implies writes. Before enabling reads, reconcile users created while writes were disabled and inspect revoked memberships rather than overwriting them.

The PGlite test executes the actual additive SQL against an isolated PostgreSQL engine, verifies two-company backfill, unchanged legacy rows, uniqueness, foreign keys, rerun preservation of revoked access and rollback. This is not an end-to-end Prisma or hosted database test. Route-level concurrent lifecycle tests, a production-like migration/backup restoration rehearsal, and the full application tenant ownership audit remain required. These tests do not prove full application isolation.

Rollback: disable tenant reads first, then compatibility writes if necessary. Keep additive tables and all existing membership data. Do not use a destructive down migration or change Meta records.

No database migration is applied by this change. Existing Meta files and credentials are unchanged.

## Transaction authorization follow-up

Account PATCH and ownership transfer now lock the workspace and affected user/membership rows, then re-read actor status, session version, role and target ownership inside the write transaction. This prevents a request that passed its initial session check from relying on stale account permissions. The original early checks remain for prompt validation.

A PostgreSQL-backed narrow adapter test exercises the production guard using actual SQL reads and row-lock statements: foreign-workspace targets, revoked actors, revoked transfer recipients, changed session versions, membership/legacy owner divergence, inactive users, and legacy operation without membership tables. This does not establish concurrent multi-connection Prisma behavior. Invitation creation/revocation and other authorization entry points still need equivalent transaction review.
