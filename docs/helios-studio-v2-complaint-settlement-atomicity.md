# Packet 30: atomic complaint preference and completion

September 28, 2026. Production ON HOLD. Live development base `43d51847de492ac73ab34e0c191681cf5abf522e`, verified Packet 29 / PR #336.

## Reproduced failure and correction

Preference/group persistence could commit before the complaint's terminal webhook update. A later failed completion write left history persisted and the event retryable. An executable composition test reproduced that split commit.

The preference helper now accepts an optional transaction client and reads prior preference state within that transaction. Existing callers still receive a self-contained transaction. The complaint handler passes its transaction to preference/group persistence and marks the webhook PROCESSED in the same commit. The failure handler updates only PROCESSING records, preventing a completed record from being downgraded if a later acknowledgement fails. No automatic takeover or new retry mechanism is added.

## Qualification

Twenty-eight targeted tests pass, including caller-settlement rollback/retry and an observed terminal write followed by an acknowledgement error. TypeScript and scoped lint pass.

The disposable Next/PostgreSQL harness holds the unsubscribe group while the real complaint request reaches it, then acquires the event row after admission/delivery persistence. Releasing the group lets the actual preference/group writes finish inside their transaction and blocks the terminal event update. The harness requires uncommitted preference/history/group state to remain invisible, an in-flight duplicate to return503, and cancellation of only that observed blocked query. After releasing the event lock it requires503/FAILED_RETRYABLE with preference/group rollback, then successful retry with one new history record, one delivery event and an inert completed duplicate. Both tenants are required. Existing earlier failure, admission, ownership and isolation cases remain required. Exact-head CI and downloaded evidence are the integration gate.

## Limits

The real database test proves handled terminal-query failure and rollback; the acknowledgement-error case is a delegate-level test, not a network fault rehearsal. Earlier suppression/client complaint flags remain a separate idempotent transaction. Arbitrary crashes, stranded PROCESSING recovery, changing ownership, global consent policy, concurrent conflicting consent changes, standalone reconciliation races and bounce audit durability remain separate work. No schema, provider, credential, hosted staging or production changes. Phase 1 remains open.
