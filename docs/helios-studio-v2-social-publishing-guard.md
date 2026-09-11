# Social publishing approval and ownership guard

Status: local implementation for a draft stacked PR after #248. No deployment, production job change, token decryption against real credentials or provider publication occurred.

## Reason for the protected publishing change

The worker previously trusted its stored snapshot without checking that the current variant, approval, media and connection still matched it. Queue creation read approval outside its write transaction. Admin job actions could change a claimed job. Those paths could publish a superseded approval or inconsistent company relationship.

This change adds checks around the existing publisher. The OAuth callbacks, token encryption/decryption implementation, provider adapters, destination IDs, payload shape and idempotency algorithm are unchanged. Regression tests use fake tokens and a fake provider only. It falls within the authorized tenant-isolation and explicit-human-approval implementation; any live provider test or protected integration configuration change still requires a specifically approved test.

## Behavior

- Queue creation revalidates workspace/editor access inside its transaction, locks the variant's existing jobs and variant, and reads owned approval, connection and media there. Existing invalidated snapshots or cancelled jobs require a new approved revision; they are not silently revived.
- Claimed jobs reserve publication under workspace, job and variant locks. The worker compares ownership, current approval actor/time/version, schedule, original idempotency key, snapshot digest and current payload digest before decrypting tokens.
- JSONB key order is normalized back to the original payload order before digest comparison. Existing digest and idempotency formats are retained.
- Invalid or stale jobs are cancelled without provider access. Disabled publishing is held with a delayed retry; expired tokens require reauthorization without modifying connection credentials.
- Content edits, reviews, schedules, archive actions and queue creation share the in-flight mutation guard. Campaign archival checks all its variants before changing state.
- Publishing-job administration rechecks the current administrator role and uses owned conditional writes. Claimed, executing and published jobs cannot be retried, cancelled or moved into manual fallback through this route.
- The adjacent project-media review found a Stream registry bypass through `externalUrl` creation/replacement. Those new Cloudflare references now require the same registry ownership as `streamUid`; an unchanged existing URL preserves legacy compatibility. Other external providers retain their existing resolution behavior.

## Verification and remaining gates

Executable tests exercise actual handlers/helpers with mocked persistence and provider boundaries: mismatched company/connection/snapshot/media, changed approval/content/schedule, rejected or archived content, JSONB key order, disabled publishing, expired tokens, lost reservation, admin role/state conflicts, archive guard ordering and Stream external URL attachment/replacement. A valid legacy snapshot retains the original payload/destination/idempotency and successful completion path through a fake provider. The full suite also retains existing provider and autopilot contracts.

Mocks do not prove transaction isolation, rollback or real provider delivery. Before deployment: rehearse multi-connection edit/claim/archive races in an isolated hosted database; drain legacy writers that do not use these locks; reconcile historical storage and external media; verify the browser approval/reapproval workflow; and obtain an approved staging provider test. Same-version, same-schedule reapproval currently requires a new revision when an old snapshot was invalidated. Recovery for interrupted VALIDATING/PUBLISHING claims remains part of the shared job/lease foundation. Approval does not attest immutable media bytes, and unknown historical storage prefixes are not certified by namespace checks. Connection-revocation races, provider reconciliation and complete asset lifecycle remain release gates.

No production deployment is authorized by these test results. Jake's readiness review and QA precede release.
