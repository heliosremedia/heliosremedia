# Social publishing settlement hardening

Status: isolated implementation on a draft branch, not deployed or release-ready.

## Reason and protected boundary

Actual worker tests reproduced two internal persistence defects: a committed publication followed by lost database acknowledgement was overwritten as `FAILED`, and a worker whose claim changed during a synthetic provider call cleared the replacement claim and wrote completion. No live publication was attempted or inferred from these tests.

The authorized change is limited to internal job persistence and queue admission. Provider adapters, payload normalization, token encryption/decryption implementation, OAuth, destination configuration, approval validation, rollout flags and retry policy remain unchanged. Real-provider tests and production rollout remain held for separate evidence and Jake's QA/release decision.

## Behavior

- Existing approval reservation still validates company, revision, schedule, snapshot, media, token expiry and publishing gates before execution.
- Claim admission rechecks both retry eligibility and scheduled time so a consistently postponed job cannot execute from a stale candidate list.
- Persistence verifies workspace, connection platform/account identity, job token, `PUBLISHING` state, attempt number, variant and snapshot identity/version under database locks.
- Connection attempt evidence must be acknowledged before provider submission. An unavailable acknowledgement stops the queue without calling the provider. This evidence records the reserved attempt, including attempts later blocked by in-memory credential/payload validation; it is not proof of submission.
- Successful completion writes job, attempt, variant, publication and connection evidence in one transaction. A provider-processing response retains its existing non-published semantics.
- Genuine provider failure classification and retry/reauthorization/manual-fallback rules are preserved, but their persistence also requires the original claim.
- Lost claims, write failure or unknown acknowledgement stop further claims and return `requiresReview`. Persistence failures are never reclassified as provider failure and never trigger a second terminal write.
- No automatic reclamation or new retry endpoint is introduced. Uncertain `PUBLISHING` records remain held. An external success whose local transaction rolled back still requires provider reconciliation, not blind retry.

## Verification and release gates

Executable worker tests use synthetic providers and database dependencies. They retain existing approval/ownership/parity cases and add success/failure acknowledgement loss, rollback, replaced claims, changed account identity, no-submission failure, backlog stopping and provider-processing/error parity. A separate PGlite test executes the actual lock SQL and real transactions for company/relationship rejection and atomic job/attempt/variant/publication/connection rollback and committed-response loss. These tests do not establish hosted Prisma/Neon concurrency, authenticated HTTP, live Meta behavior or deployed workflow parity.

Before release: verify lock ordering against every writer, transaction timeout/latency, old/new worker overlap, hosted restore and reconciliation, and explicit audited recovery. Review provider-health chronology across jobs. A lost acknowledgement during approval reservation may leave a held job; this change does not claim recovery coverage for that boundary.

Rollback is application-only with no schema migration. Do not roll a verified in-flight worker back to ID-only settlement while its jobs are still executing. Stop intake and reconcile in-flight outcomes before an old-code rollback; never reset uncertain jobs automatically. Full production migration/deployment and second-tenant gates remain in the roadmap and ledger.
