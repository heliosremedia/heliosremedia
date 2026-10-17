# Packet 57 — Shared storage diagnostic containment

The R2 verification endpoint relied on the outer signed-cookie proxy and directly probed the platform bucket. It neither refreshed account/membership authorization nor distinguished a tenant owner from a platform diagnostic context. A valid cookie could reach shared credential/bucket health checks.

The endpoint now admits only a current OWNER or ADMIN in the sole matching legacy workspace with tenant context disabled. Admission rechecks current access under the existing account lock order and verifies sole-workspace compatibility under a table lock. Tenant mode rejects every tenant role, including OWNER. Provider configuration is dynamically imported only after admission commits. Database failures return a generic unavailable response; unknown provider error names/details are redacted. Existing allowlisted diagnostic results remain available in the attributable legacy administrator context.

This is containment, not a new platform-support role or grant model. A future support workflow must use the charter's audited support boundary. No credentials, bucket policies, schema or production settings are changed, and provider work is not performed while database locks are held.

Module qualification proves no provider/configuration import for anonymous, viewer/editor, tenant-owner, foreign/multiple/missing-company, deactivated, demoted and stale-session callers, plus legacy administrator compatibility and safe failure output. Actual Next HTTP qualification rejects both companies' roles, revoked memberships and invalidated sessions with no diagnostic fields or asset changes. An explicit diagnostic-only no-network provider substitution prevents a failed containment test from contacting R2; other upload signing behavior is unchanged. Hosted provider health is not qualified here.

Phase 1 remains open. Production ON HOLD.
