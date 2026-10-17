# Packet 26: webhook admission failure ownership

September 27, 2026. Production ON HOLD. Base: Packet 25 merge `fa297db8e4de5e81e80113b82934d04fa0ef7b3e`.

## Reproduced failure and correction

Two signed requests can read the same absent event ID before either inserts it. The unique constraint correctly rejects one insert, but the route's shared catch handler previously marked the other request's event FAILED_RETRYABLE. A signed executable-handler test with a unique-constraint delegate reproduced the losing request's failure write.

The handler now records whether its admission create/update completed. Only an admitted request can write a later processing failure. Failed admission still returns503, permitting a later provider retry to observe the winning event. Ordinary admitted failures still become FAILED_RETRYABLE. The unique constraint, signature checks, identity checks, matching and domain mutation rules remain unchanged.

## Qualification

Twenty-six targeted tests pass. The new tests require one200/one503, one delivery effect, no loser failure write, preserved final state and harmless later duplicate. An admitted ownership failure must still persist FAILED_RETRYABLE. TypeScript/scoped lint/syntax/whitespace pass.

The disposable Next/PostgreSQL harness holds an event-table SHARE lock until both actual HTTP inserts are observed blocked in PostgreSQL. It also holds the target referral row so the winner cannot settle early. After releasing admission, the losing request must return503 while the winner's event remains PROCESSING and domain rows remain unchanged. Releasing the domain lock must produce200, one audit record and an inert replay. Both tenants are required; no timing-only race claim. Transaction locks are released and pending HTTP requests drained on assertion failure. Exact-head CI and downloaded evidence remain required.

## Limits

This is not a general webhook lease or claim-token design. Concurrent retries of an already failed event, partial side-effect recovery, early terminal markers, later provider-message reassignment and global consent semantics remain separate work. No schema, credentials, provider or production changes. Phase 1 remains open.
