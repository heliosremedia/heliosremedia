# Packet 43 — Public company unsubscribe

## Boundary

The public POST route recognizes the disjoint `v2.` token namespace and invokes the existing company-bound transactional consumer. Stored token provenance alone selects the company/preference. Submitted workspace, email and client IDs are ignored. Malformed, unknown, expired or failed company tokens return safe errors and never fall back to the global legacy consumer. JSON and standard one-click form requests are supported. The optional reason is trimmed and bounded to 500 characters in the company preference/history; replay does not overwrite it.

Legacy tokens retain the existing global opt-out path and scope. Company success copy refers to the company that sent the link. GET does not perform a new unsubscribe mutation. This packet does not switch delivery token issuance or administrator preference editing. Delivery eligibility was integrated in Packet 42 before this public company mutation path, so a company opt-out is respected by campaign/referral/newsletter consent checks, including compatibility mode when a company preference exists.

## Verification

Six composed route tests cover ignored forged selectors, query-token one-click forms, invalid/failing company namespace without legacy fallback, legacy handling and malformed bodies. TypeScript, scoped lint, syntax, source preparation and whitespace checks are local gates.

The real Next HTTP server and disposable PostgreSQL qualifier issue tokens through the actual trusted campaign service. In both directions, requests use the opposite company's host and forged body selectors; only the stored token's company changes. Concurrent clicks produce one history/audit transition, reason is recorded, delivery eligibility blocks only the unsubscribed company, and malformed/unknown/expired tokens return 400. A temporary required-audit trigger permits observation of the blocked HTTP transaction. Cancelling only that observed query returns a safe error and rolls back preference/history/token last-use/audit before successful retry. Trigger/function removal is verified. A real URL-encoded one-click request passes, and a separate legacy token still opts out both same-address company contacts without changing company rows.

Exact-head regression/TypeScript/Chromium and runtime CI, independent artifact verification and merged-tree identity are required before integration. Runtime evidence retains its existing explicit substitutions and synthetic-only scope. No provider calls, hosted migration, real customer onboarding or production deployment. Phase 1 remains open. Production ON HOLD.
