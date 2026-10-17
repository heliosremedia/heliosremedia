# Packet 24: signed webhook payload boundary

September 27, 2026. Production ON HOLD. Base: Packet 23 merge `acd33aad5df34c28d8d03a187353f7df8b2509cb`.

## Reproduced failures and correction

Actual signed route tests reproduced an uncaught TypeError for JSON null and admission of inherited event names through the status object's prototype. Consumed payload fields could also reach string methods without type checks.

Signature and timestamp admission still runs first. JSON must be an object with a string event type. Only own keys of the supported status map are accepted. Unknown string types return ignored200 without database access. Supported events validate the optional timestamp, data object, message ID, click object/link, and bounce object/type/subtype/message before querying or mutating the database. Invalid shapes return400 with a fixed diagnostic; no payload content is logged.

Nullable/absent optional fields keep missing-ID reconciliation behavior. Invalid date strings still use receipt time. Diagnostic recipients are sanitized by the existing helper; tags never select ownership. Unknown extra provider fields remain allowed. Existing ownership, signature, deduplication and consent rules are unchanged.

## Qualification and limits

Twenty-two targeted tests pass, including actual signed handler execution, existing ownership policy and bounce utilities. TypeScript, scoped lint and syntax checks pass. The disposable Next/PostgreSQL qualification adds both-host signed malformed and unknown/inherited-type requests, with unchanged domain/consent rows and webhook event count. Prior runtime cases and schema/access postflight remain required. Exact-head CI and artifact inspection are required before closing this packet.

This does not establish hosted/provider parity, concurrent identity reassignment safety, full retry/concurrency recovery, or tenant-local consent semantics. No schema, credential, production or live provider change. Phase 1 remains open.
