# Packet 27: conditional webhook retry admission

September 27, 2026. Production ON HOLD. Independently verified development base: `a1cfe6e0267382b2106cdebd44033baa7530e024`, Packet 26 / PR #333. Both exact-head Packet 26 workflows remain successful. Roadmap, progress ledger and automation checkpoint were reread from live source before this packet.

## Reproduced failure and correction

Two signed requests could both read FAILED_RETRYABLE and unconditionally change the same event to PROCESSING. An executable signed-handler test reproduced two successful admissions. Both could execute domain effects, including duplicate referral audit creation.

Retry admission is now one conditional database update matching provider event ID, original message ID, event type and FAILED_RETRYABLE status. Only count1 admits processing. A request that loses admission returns503 before domain lookups or writes, and cannot mark the winning request failed. Unchanged single retries and settled duplicate acknowledgement remain intact. No automatic recovery of PROCESSING records is added.

## Qualification

Twenty-seven targeted tests pass, including concurrent failed-event retries for email/referral families and both tenant identities, one domain effect sequence, preserved winning state and subsequent duplicate handling. Existing payload/signature/ownership and failed-admission protections remain covered. TypeScript/scoped lint/syntax/whitespace pass.

The disposable Next/PostgreSQL harness now runs first-admission and failed-event retry scenarios for both tenants. It observes both HTTP admission writes blocked by a table lock, then separately holds the winning referral domain write. The loser must return503 while the event remains PROCESSING and domain rows remain unchanged. After release, the winner must return200, produce exactly one audit and permit an inert replay. Locks release and pending requests drain on failure. Exact-head CI and independent artifact inspection remain required before qualification is claimed.

## Limits

This qualifies overlapping retries while one processor remains active and then settles successfully. It is not a durable generation token or lease and does not establish fencing across repeated failure/reclaim cycles, crash recovery, partial side effects, early terminal markers, changing provider-message ownership or tenant-local consent. Those boundaries remain open. No schema, credentials, hosted staging, live provider or production change. Phase 1 remains open.
