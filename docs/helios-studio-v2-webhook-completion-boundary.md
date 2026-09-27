# Packet 28: webhook follow-up completion boundary

September 27, 2026. Production ON HOLD. Verified development base `61be715b15febd3c2573f69cbd54bd2d367c0bca`, Packet 27 / PR #334.

## Reproduced failure and correction

The email path committed PROCESSED before complaint preferences or permanent-bounce grouping ran. A signed-handler test held those follow-up calls and observed premature completion. Duplicates arriving during PROCESSING were also acknowledged as successful.

Email complaint/bounce events now retain PROCESSING with null processedAt after their delivery record is retained. Complaints become PROCESSED only after preference persistence and unsubscribe-group reconciliation return. The bounce helper retains its existing terminal decisions after grouping/validation. Already accepted bounce failures unwind to the admitting route for one failure-settlement owner instead of releasing retry in both layers. In-flight duplicates return503 without taking over processing; settled duplicates retain200. No automatic retry or takeover of a stranded PROCESSING record is added.

## Qualification

Twenty-eight targeted tests, TypeScript, scoped lint and syntax/whitespace pass. Executable signed-handler tests hold complaint/bounce follow-up, require nonterminal state and duplicate503 without effects, inject failure, require FAILED_RETRYABLE, and preserve complaint retry/completed duplicate behavior.

The disposable Next/PostgreSQL harness holds a synthetic preference or bounce-group row until the actual follow-up query is observed waiting. Delivery persistence must already exist while the event remains PROCESSING; duplicate503 must not change rows. It cancels only the backend query blocked by that held synthetic lock, checks503/FAILED_RETRYABLE, then releases the lock and retries the identical event. Both tenants and both event types must finish with one delivery record, completed preference/group effects, and an inert final duplicate. Complaint suppression persisted before the failure must remain unique, and the rolled-back preference transaction must create exactly one preference event after retry. No timing-only failure claim or application fault endpoint. Locks release and pending requests drain in finally. Exact-head CI/artifact inspection is required.

## Remaining limits

This proves handled query failure before the selected follow-up mutation, not arbitrary process crashes, durable generation fencing, or exactly-once effects across every failure boundary. A failure after preference commit but before group reconciliation can still repeat preference-history writes on retry. Bounce audit remains the existing best-effort audit helper; its durability is not improved or claimed here. Repeated failure/reclaim races, out-of-order event semantics and global consent scope remain separate work. Schema and provider/credential configuration are unchanged. The fault injection is restricted by the runner's fixed disposable-local-database gate. No hosted staging or production action. Phase 1 remains open.
