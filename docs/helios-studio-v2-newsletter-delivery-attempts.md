# Durable newsletter delivery attempt evidence

Status: draft after #274. No production migration, provider send or deployment.

## Why this protected workflow change is needed

Holding an uncertain delivery prevents an immediate duplicate, but a status alone cannot establish which recipients or request were involved. Recovery needs evidence written before provider execution and a separate durable receipt before recipient-state persistence.

## Implementation

NewsletterDeliveryAttempt stores explicit company ownership, delivery/revision identity, captured execution version, batch number, recipient record IDs, request hash, provider operation ID and the exact provider idempotency key derived by the existing adapter helper. It does not store rendered email bodies, email addresses or unsubscribe bearer tokens. Its initial PREPARED record must commit before the provider is called. A second fresh authorization and active-edition check occur in that transaction.

The provider's ordered receipt IDs are recorded as ACCEPTED before updating recipient statuses. A later database failure preserves that evidence. Uncertain provider outcomes record UNCERTAIN when possible; if that write fails, PREPARED itself requires reconciliation. Explicit configuration failures record REJECTED. Attempt persistence failure prevents sending. Terminal observations and request identity cannot be rewritten by ordinary updates.

An additive migration creates only the new enum, table, indexes and trigger. It validates company/campaign/revision/execution relationships, campaign ownership of recipient IDs, unique execution/batch identity and immutable request fields. Restrict relations protect parent records from deletion. A legacy series may be used only for the sole company and an explicitly owned campaign. An old ownerless campaign must be reconciled before it can generate new attempts. Existing deliveries receive no fabricated historical attempts.

## Evidence and release sequencing

The full suite passed 594 tests, zero failed. Non-incremental TypeScript, Prisma client generation, scoped ESLint and diff checks passed. An isolated PGlite migration test exercises cross-company, stale-execution, foreign-recipient, duplicate, identity-mutation and invalid-receipt rejection, parent deletion protection, and unchanged existing delivery rows. Orchestration tests verify prepared-before-provider behavior and retained accepted/uncertain evidence after persistence failures.

PGlite is not a Neon rehearsal. Apply/rehearse this migration before an application using attempts runs. Do not rely on the legacy production build's automatic migration behavior. Old code can still write its original tables, but it does not honor attempt evidence; operational rollback must prevent newsletter dispatch until in-flight and held work is reconciled. No destructive table-drop rollback is authorized once evidence exists.

## Remaining gates

This adds evidence, not an automatic recovery command. Reconciliation must validate company, edition, attempt, recipient and provider receipt relationships, preserve webhook facts, and avoid re-sending accepted or uncertain recipients. PREPARED cannot prove that the provider was never called. A request hash is not a replayable payload. Receipt IDs do not prove inbox delivery. Explicit reconciliation history, provider lookup capability, hosted lock/lease races, legacy campaign mapping, interrupted-run recovery and approved browser/test-send QA remain required before release. No tenant deletion endpoint is exposed.
