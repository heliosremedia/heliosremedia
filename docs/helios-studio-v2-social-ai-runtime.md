# Packet 34: Social AI persisted output qualification

October 2, 2026. Base `ef0d0dd171d7ff5d412f675d2b105d67f9d22900` independently confirmed as merged Packet 33 / PR #340. Phase 1 remains open; production ON HOLD.

## Scope

Extends the existing disposable PostgreSQL / Next build-and-start harness beyond the synthetic persistence used by Packets 32–33. Actual HTTP sessions, workspace membership checks, generation admission, project facts, variant mutation locks, approval revocation and campaign completion execute against PostgreSQL. Application source and schema remain unchanged in the repository.

The disposable app copy gets one additional documented substitution: the Social AI route imports a lexical synthetic fetch implementation and uses a fixed synthetic key literal. No provider credential is added to the runtime environment. Both existing fetch sites must match the reviewed preparation assertions. The fixture accepts only the expected endpoint, synthetic identity and owned source marker, has no network fallback, and returns deterministic generation/grounding responses. Three fixture tests cover A/B output and invalid destination/identity/facts rejection.

## Required exact-head runtime evidence

For each tenant, the harness requires:

- Foreign campaign and variant 404; foreign project source 409; rejected requests leave campaign/variant/approval snapshots unchanged.
- Valid generation persists the owned draft, increments content version once, removes approval, records one REVOKED approval event and completes the owned campaign. Forged body workspace is ignored.
- Same-request replay reports duplicate and changes no domain snapshot. The other tenant remains unchanged.
- A PostgreSQL advisory lock pauses the synthetic provider response after admission has committed RUNNING. Observed lock wait is required before revoking membership. Releasing the lock must yield HTTP 403, FAILED generation and unchanged variant/approval rows, with the foreign tenant unchanged. Finally drains the request before restoring membership.
- No publishing jobs or publications created. Existing request/portfolio/webhook cases and schema/access postflight still pass.

The fixed empty local database gate and existing workflow service are unchanged. No staging/Neon target, hosted Preview, live provider, credentials or production operation is involved. Test records exist only in the disposable CI database; access is restored and the service is discarded after the run. Rollback is reverting this harness-only packet.

## Limits and local checks

This is PROJECT-source runtime qualification with a substituted provider, not hosted or actual provider behavior. BLOG/NEWSLETTER remain composed-module coverage from Packet 33. It does not qualify provider timeouts, partial multi-variant transaction failures, crash recovery, source ownership changes during generation or duplicate request IDs across tenants. Request IDs here are distinct because the existing schema has a global unique constraint; this packet makes no tenant-scoped idempotency claim.

Eighteen targeted cases, TypeScript, scoped lint, syntax, whitespace and disposable source preparation pass locally. The local sandbox blocked a loopback listener and git subprocess; the same checks passed with execution permission, without database or provider access. Actual PostgreSQL runtime, downloaded artifact inspection and exact-head regression/Chromium must pass before integration. Final results are recorded on the PR and coordination checkpoint. No Phase 1 exit is claimed.
