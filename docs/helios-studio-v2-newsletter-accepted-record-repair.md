# Repairing missing newsletter acceptance records

Status: draft after #276. Implements an explicit administrator POST action; no live repair, email send or deployment has been performed.

## Scope and protected behavior

A committed ACCEPTED attempt can survive a failed recipient-state write. The new action repairs only missing acceptance records with one unambiguous receipt. It requires the reviewed edition version, explicit REPAIR_ACCEPTED_DELIVERY_RECORDS confirmation and fresh administrator access. A scoped edition/version lock and the same ownership/evidence checks as the read-only review run inside the transaction.

Only PENDING or FAILED recipients with no provider ID, no sent timestamp and no delivery/webhook events qualify. Conflicting receipts, PREPARED/UNCERTAIN overlap, invalid evidence, historical SENT records and SKIPPED records are excluded. Accepted evidence alone does not override a later provider failure. Conditional writes compare the captured recipient status, provider ID and sent timestamp and require both event relations to remain empty.

The action records the existing receipt ID and its recorded acceptance timestamp. A mandatory audit entry with company, actor, recipient IDs and attempt IDs shares the transaction; audit failure rejects the repair. Repeated repairs are no-ops once records agree. Stored attempts and event history remain unchanged.

The action does not invoke providers, resume a job, change edition state, rebuild campaign aggregates, alter consent/suppression, or enable automatic retry. A repaired record establishes recorded provider acceptance, not inbox delivery. Further aggregate and execution reconciliation is a separate dependency.

## Verification and release gates

Verification counts are recorded in the progress ledger. Executable tests cover fresh authorization, version/ownership lock predicates, conditional writes, idempotency, conflicts, uncertain evidence, protected historical/webhook records, mandatory audit errors and explicit HTTP confirmation. Tests use mocked transactions and do not prove real rollback or hosted concurrent webhook behavior.

Browser controls, hosted rollback/lock tests, review pagination, provider reconciliation for uncertain requests, campaign aggregate reconciliation, execution leases and approved test-send QA remain gates. No historical or customer data was modified during implementation.
