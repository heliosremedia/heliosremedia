# Packet 29: atomic preference and group reconciliation

September 27, 2026. Production ON HOLD. Development base `acf34c9f7ac9fba4e29c47fd62aba17024669f04`, verified Packet 28 / PR #335.

## Failure and correction

A failed unsubscribe-group mutation left the preference, client projection and preference history committed. A complaint retry could then append that history again. Two executable tests reproduced the split commit for unsubscribe and resubscribe operations before the correction.

`setMarketingPreference` now performs group reconciliation through its existing transaction. Preference, history, client projection and group changes commit or roll back together. The reconciliation helper accepts a transaction client; existing standalone callers retain their current behavior. No consent scope, status policy, provider contract or schema changes.

## Qualification

Local executable rollback/retry tests cover both membership creation and deletion. The disposable Next/PostgreSQL harness adds a later complaint failure for both tenants: hold the existing unsubscribe-group row, observe the request blocked after preference writes, require that those uncommitted writes are invisible, cancel only that blocked synthetic query, then require rollback and FAILED_RETRYABLE. A successful retry must add exactly one history entry, restore group membership, retain one delivery event and leave a final duplicate inert. Earlier complaint and bounce failure cases remain required. Exact-head CI and downloaded evidence must pass before integration.

## Limits

This closes handled failure inside preference/group persistence. A later failure after the combined transaction commits but before the webhook is finalized can still replay history. Arbitrary crashes, concurrent conflicting consent changes, standalone reconciliation races, global consent scope, stranded PROCESSING recovery and best-effort bounce audit remain separate work. The transaction now holds its preference/client locks through group reconciliation; existing transaction timeout/failure behavior remains in force. No hosted staging, provider, credential or production action. Phase 1 remains open.
