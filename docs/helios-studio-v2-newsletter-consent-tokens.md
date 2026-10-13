# Packet 48: newsletter consent token integration

Newsletter delivery now calls the qualified campaign token selector with stored workspace, campaign, recipient, address and campaign version. Its provider operation ID and approved-revision idempotency key are unchanged. Existing legacy links retain their scope; the selector continues to reject ambiguous protocol changes before preparing a provider attempt.

A retry reactivates its existing campaign inside the transaction holding delivery authorization and the edition claim. The update binds campaign ownership, rowVersion, delivery edition and approved revision, and changes only campaign status to SENDING. It does not increment the campaign revision or rebuild the approved payload. Null historical campaign ownership remains confined to tenant mode off and a sole matching workspace.

Before reactivation, unresolved PREPARED/UNCERTAIN attempts require reconciliation. ACCEPTED attempts must have unique recipient and receipt identities, and every recipient must already be SENT on this campaign with its matching provider message ID. REJECTED attempts cannot carry contradictory receipt evidence. Foreign workspace/revision history, missing receipt persistence, stale campaign version or mismatched delivery binding rejects the enclosing claim. Successful recorded batches remain preserved while known rejected work can retry.

## Evidence and limits

Twenty-one focused module tests cover existing approval, authorization, eligibility, uncertainty and receipt behavior, new retry-history validation, stable campaign version, restrictive legacy compatibility and token-conflict rejection before provider attempt creation. Existing actual delivery-module fixtures assert the exact stored arguments passed to the token selector. Provider operations are synthetic adapters only.

Disposable PostgreSQL qualification uses the actual retry transaction and token services for both workspaces. It checks uncertain and unrecorded accepted outcomes, enclosing edition-claim rollback, foreign/stale bindings, stable company tokens after a rejected attempt and preserved accepted batches. It does not claim a full hosted newsletter delivery or live provider check. Existing campaign, consent HTTP, schema/index and access postflight qualification remain in place.

Local gates: TypeScript, scoped lint, syntax, source preparation and whitespace. Exact-head CI and independently inspected runtime artifacts are required before integration.

No schema, credential, sender-policy or deployment changes. Referral token issuance, company unsubscribe analytics attribution, broader delivery reconciliation and remaining Phase 1 categories remain open. Production ON HOLD.
