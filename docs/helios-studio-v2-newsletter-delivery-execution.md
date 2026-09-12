# Newsletter delivery execution checkpoint

Status: unfinished draft after #272. Development runtime unavailable; final TypeScript and recovered-tree verification pending. Production release remains held.

## Why the orchestration change is needed

First sends had a conditional edition claim, but retries reused an existing campaign without claiming the edition. A scheduled worker or administrator could enter an already active send. Delivery also lacked an explicit execution actor or current job claim.

## Implemented locally

- Capture the administrator actor or SEND job ID/token at the call boundary.
- Verify fresh administrator access or the stored company's current, due, unexpired SEND lease before eligibility, at claim, and before each batch.
- Reject a manual send while a SEND job is claimed.
- Compare edition version/state/date/company/approval for first sends and retries, then increment the version and enter SENDING.
- Cancel pending scheduled sends only inside a successful manual-send claim.
- Reject SENDING re-entry. Compare the captured execution version and company when persisting completion.
- Preserve provider adapters, payload construction, preference tokens and existing batch idempotency keys.

## Evidence and recovery

The local full suite passed 587 tests, with zero failures. Focused ESLint and diff checks passed. Final non-incremental TypeScript was interrupted by runtime disconnection and is not verified. The recovery draft was reconstructed from #272 and recorded successful edit commands; exact equivalence to the inaccessible local tree has not been established. Rerun tests and TypeScript after restoring an execution environment.

Tests use fake database/provider dependencies. They cover denied initial/claim/batch authorization, copied actor identity, invalid SEND claim predicates, active-send denial, lost retry claims, and unchanged first/retry payloads and idempotency. They do not prove hosted locking, transaction rollback or provider acceptance.

## Outstanding gates

A stopped SENDING execution is not automatically restarted. Explicit delivery reconciliation and safe recovery must be implemented before deployment; simply changing its status could duplicate previously accepted emails. Eligibility still needs refresh between batches. Provider calls remain outside database transactions; final-check races, lease expiry during a batch, uncertain provider acceptance, per-recipient progress and historic idempotency require dedicated rehearsal. Add friendly conflict responses and an actual send-now handler test, then continue the remaining roadmap.

No real-recipient tests, provider configuration changes, migrations or deployments were performed.
