# Packet 37: company-scoped Social AI request identity

## Problem and correction

SocialCampaign.generationRequestId was globally unique even though claims and replay are scoped to the authenticated workspace and campaign. A request ID already used by Company A could prevent Company B from generating a draft. The module isolation harness permits the same ID across companies; a real PostgreSQL test is needed to enforce that promise.

Replace the global unique index with a unique index on (workspaceId, generationRequestId). The transactional migration creates the company constraint before dropping the global constraint. Existing request values remain unchanged; null requests remain permitted, same-company uniqueness remains enforced, and no application query uses the removed global unique selector.

## Disposable runtime qualification

Only after empty-database admission and synthetic seeding, reconstruct the previous global index and reproduce both-direction collisions through the actual HTTP route. The winning tenant succeeds; the other receives the existing generic preparation error without changing either tenant's persisted state. Apply the checked-in migration SQL to this disposable database, then require both formerly blocked requests to succeed without changing the earlier winner.

Require owned output, unchanged request values, independent inert replay, continued rejection of the same request ID on another campaign within the same company, and concurrent A/B success using an identical new request ID. Compare all declared database indexes before and after, in addition to existing column/access postflight. Synthetic provider substitution remains in effect.

Prisma validation, generation, TypeScript, scoped lint and script syntax checks precede publication. Exact-head regression/runtime and downloaded artifact inspection are required before integration.

## Release boundary

This adds a migration file but applies it only to the disposable synthetic CI database. Hosted staging and production remain unchanged. A future hosted candidate must independently qualify its schema/migration identity under its protected workflow; historical Packet 16 schema evidence does not cover this migration. Production migration requires separate owner authorization and rollback review. Reinstating global uniqueness after companies have reused IDs can fail, so rollback cannot blindly recreate the old index.

Same-company cross-campaign conflicts retain the existing generic HTTP 500 preparation response. Arbitrary process recovery and source mutation during generation remain outside this packet. Phase 1 remains open; the separate consent architecture decision is pending. Production ON HOLD.
