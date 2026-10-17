# Packet 25: immutable webhook retry identity

September 27, 2026. Production ON HOLD.

## Reproduced failure

The handler previously loaded only processingStatus for an existing event ID. A signed request reusing a failed event ID with another message ID could process a different tenant's message and change diagnostic ownership while leaving the original stored providerMessageId intact. An executable signed-route test reproduced200 instead of rejection.

## Bounded correction

Existing events now select their stored message ID and event type. Both must equal the incoming validated identity before duplicate acknowledgement or failed-event retry. A mismatch returns409 with a fixed diagnostic before message lookups or mutations. The existing event row is preserved. Message IDs use the handler's existing trim/null normalization; an identical failed identity remains retryable. No payload hash, provider account namespace, schema migration, or new recovery policy is introduced.

## Verification and remaining boundaries

Twenty-four targeted tests pass, including changed message/type across failed, processing and processed event states for both tenants, unchanged-row/no-effects checks and preserved valid retry. TypeScript/scoped lint/syntax/whitespace checks pass.

The disposable Next/PostgreSQL harness checks changed message/type on both processed and failed events, for both tenants and both email/referral families. It requires409, unchanged domain rows and byte-equivalent event fields, then confirms unchanged replay and owner-restored retry still succeed. Exact-head CI and downloaded artifact inspection remain the qualification gate.

This guards only the immutable event/message pair. It does not bind every payload field, solve simultaneous claim/settlement races, fence later message reassignment, or change global consent semantics. A valid provider signature is still required. Production and live provider connections remain untouched; Phase 1 remains open.
