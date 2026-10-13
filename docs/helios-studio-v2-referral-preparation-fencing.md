# Packet 50: Referral preparation lease fencing

Referral preparation checks launch status and attempt identity before entering its batch transaction. A lease takeover or revision/ownership change between that read and the batch can therefore admit stale preparation. Progress, completion and failure previously matched attempt identity without the specific acquired lease.

## Change

The worker carries the exact acquired lease expiration as its existing lease identity. Batch preparation locks the company, campaign and approved revision, then rechecks stored company, campaign version, approved/launch revision, revision parent, launch attempt, failure state, lease identity and current expiry in the transaction that writes the batch. The current legacy-only wrapper also locks the workspace table and requires tenant mode off with exactly one matching company; this does not activate multi-company referral sending.

Progress settlement matches the old lease before renewing it. Only a successful renewal advances the local worker's lease. Completion and failure use the same owned campaign/revision/attempt/lease predicate. A worker whose lease has been replaced cannot modify the replacement worker's state. Expired preparation is not converted into a send or a retry of provider delivery.

Existing rendered communications, unsubscribe token protocol, provider idempotency keys and sender containment remain intact. Scoped referral token issuance is still separate follow-up work; this packet is its job-safety prerequisite. No new schema, provider calls or production operations.

## Evidence boundary

Module tests exercise actual processor composition for denied batch admission, lost progress lease and successful renewal/completion. Guard tests cover single-company containment, foreign/null owners, snapshot shape/ownership and exact predicates.

Disposable PostgreSQL qualification exercises the actual source/lease core in both directions, observes a campaign-row wait followed by lease replacement, rejects the stale worker after that wait, proves stale renewal/completion/failure predicates affect zero rows, and admits the replacement lease. It separately verifies the production wrapper remains contained with two companies. This is source/settlement-core evidence; it does not execute the full legacy batch or a sending provider in that two-company database. No broader referral activation is claimed.

Phase 1 remains open. Production ON HOLD.
