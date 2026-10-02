# Packet 32: Social AI source-to-prompt isolation

October 2, 2026. Fresh base `df3912cf771a0d141d097089ccc70a859d1043a7`, independently confirmed as merged PR #338. Its exact-head regression 36714191483 and isolated runtime 36714191069 remain successful. Canonical charter, roadmap and progress ledger reread. Phase 1 remains open; production remains ON HOLD.

## Scope

The Phase 1 matrix calls for executable AI source/prompt/output isolation, beyond actor propagation and separate helper tests. This packet composes the actual Social AI route with generation admission, source-context resolution, project facts reader, settings reader, core normalization and deterministic grounding. It changes tests and documentation only. Existing application behavior passes; no refactor is warranted by these cases.

`lib/social-generation-isolation.test.ts` executes four cases:

- Both tenant directions reject a foreign campaign or variant with 404 and foreign project references with 409, without provider calls, output writes or campaign mutation. Cached facts cannot rescue an invalid source.
- A request from A pauses at the provider adapter while B completes. Both use the same request ID and submit the opposite workspace ID in their request body. Each generation and grounding prompt contains its own freshly loaded project facts, excludes the other tenant's markers and poisoned cached facts, and uses its own company/voice. Output callbacks target the owned variant; completion stays scoped to the owned campaign. Duplicate requests make no further provider or output calls.
- Revoking A in the current-access adapter while its provider response is pending rejects settlement with 403; A gets no output callback and records FAILED, while B's successful result remains intact.

## Evidence boundary

These are module-composition tests. Session context uses AsyncLocalStorage. Database delegates, transaction execution, current authorization and variant persistence are synthetic adapters; fetch is an in-memory provider response with a fixed endpoint assertion and no real key. Query predicates are evaluated against separate tenant records rather than returning a preselected record regardless of scope.

Actual PostgreSQL locks/rollback, Next HTTP authentication, real provider behavior, hosted execution and persisted output authorization are **not** qualified here. The output adapter observes route dispatch arguments; it does not execute `updateVariantContent`. Existing ownership tests remain relevant, and a future disposable-database Social AI packet is still needed. Only PROJECT source composition is covered; BLOG, NEWSLETTER and image-generation composition remain open.

No schema, migration, consent-policy, credentials, live provider, hosted staging or production changes. The separate consent architecture proposal remains pending; this packet neither adopts it nor changes legacy opt-out behavior. Rollback consists of reverting these tests/docs on the non-production branch.

## Qualification

Four new composed cases plus six existing generation/source cases pass locally. TypeScript and scoped lint are required before publication; exact-head regression/Chromium CI is required before integration. The PR records the final run, head and result. This preparation document does not claim a future CI result or Phase 1 exit.
