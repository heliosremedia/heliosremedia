# Packet 31: atomic permanent-bounce audit

September 30, 2026. Production ON HOLD. Live development base `5e62ba395a859f6771763dd28ae16ae1344b64ee`, verified Packet 30 / PR #337.

The permanent-bounce processor previously completed membership/event persistence before calling the best-effort audit helper. Audit failure could therefore leave a completed event with no audit and no retry path. Two executable tests reproduced the missing rejection before correction.

The bounce processor now writes its owned audit, group membership and terminal event in one transaction. Audit failure propagates through existing retryable handling. The shared best-effort audit helper and all unrelated callers remain unchanged. Group upsert remains an earlier idempotent operation; one delivery record may already exist before this transaction. No new automatic recovery or ownership policy is introduced.

Qualification requires both-tenant real HTTP/PostgreSQL audit-write failure: hold the disposable AuditEvent table against inserts, observe the actual blocked request, require PROCESSING and invisible membership, cancel only that blocked query, then require FAILED_RETRYABLE with no membership/audit writes. After releasing the lock, retry must produce one owned audit, one membership and one delivery event; completed replay must be inert. Existing isolation and earlier failure/recovery proofs remain required. Local tests, TypeScript, scoped lint and syntax/whitespace are checked before exact-head CI and independent artifact inspection.

Limits: arbitrary crashes, stranded PROCESSING recovery, changing ownership, event-order races and global consent scope remain separate. This transaction does not make the entire delivery-feedback pipeline exactly once. No schema, credential, provider, hosted staging or production changes. Phase 1 remains open.
