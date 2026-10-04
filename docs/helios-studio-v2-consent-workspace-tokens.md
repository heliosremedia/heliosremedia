# Packet 41 — Company-bound unsubscribe token services

## Scope

Under Jake's approved consent boundary, add inactive campaign token issuance and consumption. No public endpoint or delivery caller is switched in this packet. Existing legacy token format, validation, persistence and unsubscribe scope remain unchanged. Phase 1 remains open; production ON HOLD.

The trusted delivery entrypoint requires explicit workspace, campaign, recipient, campaign version and recipient email from its owned worker context. It locks and rechecks the owned active campaign, pending/failed recipient snapshot and client membership; company SUBSCRIBED and no protected legacy/safety block are required. A token cannot supply or select a different company during consumption. The stored workspace/preference binding is authoritative.

Versioned `v2.` tokens are disjoint from legacy tokens. HMAC input includes a purpose namespace, workspace, campaign, recipient and normalized email. A server-supplied signing secret is required; this packet neither changes credentials nor activates a signing configuration. Stable tokens preserve delivery retry payload identity. Only SHA256 hashes are stored. Issuance verifies existing provenance before extending expiry, and never rebinds an existing hash.

Consumption owns a transaction and locks the workspace and token, then rechecks expiry after waiting. A company unsubscribe, history entry, required audit and last-use timestamp commit together. Concurrent replays produce only one transition/history/audit. Shared contact flags, global legacy preferences/tokens and safety suppression are not mutated. Existing conservative legacy blocks remain in eligibility.

## Qualification

Four pure tests cover stable retry identity, contextual namespace separation, legacy/malformed format rejection and missing signing configuration. TypeScript, scoped lint, syntax and driver preparation are required locally.

The isolated PostgreSQL runtime invokes the actual service via the existing Node driver sentinel substitution. Both directions cover foreign campaign/recipient rejection, stale/cancelled campaign, removed client membership, email mismatch, hash-only storage, retry stability, concurrent consumption, unchanged other-company state and protected legacy opt-out minting rejection. It holds the workspace lock, observes the waiting consumer, expires the token and checks no transition or last-use update occurs. A temporary audit trigger then blocks the actual required insert; only the observed blocked query is cancelled, proving preference/history/token/audit rollback before successful retry and inert replay. Trigger/function removal, legacy rows and existing schema/index/access postflight are asserted. Synthetic fixed signing material only; no providers, hosted database or deployment.

Exact-head CI and independently downloaded runtime artifact are integration gates. Company token route activation remains deferred until the relevant delivery readers consume company consent; otherwise an unsubscribe could appear successful while delivery still consulted legacy permission.
