# Newsletter delivery relationship guard

Status: local implementation under review after draft #271. Production release remains held for rollout gates and Jake's QA.

## Reason for the protected workflow change

Company-scoped approval snapshots and valid content hashes did not prove that the selected revision belonged to the edition, that the approval matched that revision/date, or that an existing delivery campaign still represented the approved content. These relationships can become inconsistent independently of OAuth/provider configuration. Reusing such a campaign risks mixing approved content with a different subject or revision.

## Changes and preserved behavior

Delivery now checks edition/revision/approval identity, current revision number, revocation state and intended date before recipient resolution. Existing deliveries must match the edition/revision, verified hash, campaign identity, newsletter body identifiers and approved subject/preview. A verified legacy revision hash remains acceptable alongside the canonical hash. Campaign body blocks are not a delivery source; the approved immutable revision remains the source of rendered blocks.

The first-delivery claim additionally compares captured edition version/date/company and the specific active approval before campaign creation. This is orchestration validation around the existing adapter. Resend configuration, webhooks, tokens, sender settings, preference tokens, provider payload construction, batch keys and idempotency format are preserved. No real email or notification is part of these tests.

## Verification and release gates

Executable tests exercise invalid relationship rejection before recipient/token/provider effects, failed initial claims, and first delivery/retry with a fake provider. Legacy hash compatibility is tested through the actual integrity verifier. The full suite passed 584 tests with zero failures. Final non-incremental TypeScript, focused ESLint and diff checks passed.

Hosted concurrency, historical relationship reconciliation, active retry leases, eligibility changes between batches, sender/recipient isolation, completed upload/media provenance and actual browser/test-delivery parity remain open. Mocked transactions do not prove rollback or provider acceptance. This change does not authorize a production send, migration, deploy or real-recipient test.
