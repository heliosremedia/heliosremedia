# Packet 36: Social AI provider failure preservation

## Scope and reproduced defect

The grounding response advertised a strict JSON schema but trusted parsed JSON locally. An empty platform object returned HTTP 200, advanced content version and revoked approval. A malformed caption could be stringified into publishable content. The route composition test reproduced 200 instead of the required 502 before the fix.

Validate the complete grounding envelope, campaign brief, requested platform set and field types before deterministic grounding or any content transaction. This enforces the existing provider contract without changing approval policy or publishing behavior. Existing nonempty campaign brief checks remain in place.

## Qualification

The existing route ownership test now rejects empty drafts, object captions, non-string hashtags and unexpected draft fields without content writes. The provider fixture tests each failure only at its selected stage.

The disposable Next/PostgreSQL harness runs eleven failure modes for each tenant: generation HTTP error, malformed JSON and timeout; grounding HTTP error, malformed JSON, empty platform draft, object caption, missing platform, invalid brief, extra root field and invalid removed-claims list. Every case requires HTTP 502, sanitized error, unchanged variant and approval history, owned FAILED settlement, unchanged foreign rows, same-request recovery, exactly one approval revocation after successful recovery and inert replay.

The provider remains a lexical substitute in the disposable application only, with synthetic credentials and no network fallback. No live provider calls, hosted staging changes, migrations or production changes. Earlier runtime checks and schema/access postflight remain required. Exact-head regression, runtime and downloaded artifact verification are required before integration.

## Remaining boundaries

This does not qualify arbitrary process crashes, source mutation during generation, cross-tenant request-ID reuse, hosted provider behavior or broad Phase 1 exit. Consent architecture remains a separate owner decision. Production ON HOLD.
