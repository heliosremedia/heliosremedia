# Packet 18: request reader and session isolation

September 26, 2026. Parent: Packet 17 merge `ad732e95586db48ba7b879e5b8ef85373fd4e720`. Production remains ON HOLD.

## Reviewed runtime boundaries

The public homepage (`app/(public)/page.tsx`) explicitly exports `dynamic = 'force-dynamic'`. `lib/public-workspace.ts` reads the current Host header and resolves an active PUBLIC_SITE domain. `lib/site-settings.ts` delegates to `loadWorkspaceSettings` and reads Prisma directly. The tenant-enabled path rethrows resolution/database failures instead of returning Helios defaults. No persistent application cache wrapper was found in this reviewed reader chain; introducing cache machinery is not justified by this review.

`lib/auth/session.ts` verifies the signed token, reads the current user/session version and obtains current membership through `lib/workspace-memberships.ts`. Neither Host nor the signed role supplies current workspace authority. The installed Next documentation for headers and dynamic rendering was reviewed before test implementation.

## Executable evidence

`lib/workspace-request-isolation.test.ts` loads one shared instance of the actual TypeScript module graph, including host normalization, public resolver, settings reader, signed-token verification and membership policy. Its strict dependency allowlist rejects unexpected imports. Request headers/cookies use an AsyncLocalStorage adapter; database delegates use synthetic in-memory records. No production environment values are inherited into the executed application modules.

Four tests cover:

- Alternating A/B reads with the same logical heading, followed by an A-only fixture change and fresh A/B reads. Both data and queried workspace identities are asserted.
- Deterministic overlap: pause A's domain lookup, finish B, then resume A. Both results and lookup order must retain tenant identity.
- Unknown/inactive/missing Host after a successful read, hostile forwarding/workspace headers, and missing tenant settings. No fallback to a previous tenant or Helios default is allowed.
- Real signed tokens across repeated requests, current membership role overriding the signed role, revoked membership, incremented session version, corrupted signature and anonymous access. Tenant B remains usable after A is revoked.

The existing reader/session implementation passed these cases; no application correction was needed. Changes are regression tests and documentation only.

## Limits and remaining work

These tests execute application code through synthetic request/database adapters. They do not execute a Next server, Prisma transport, real database transactions, CDN cache, browser router cache or hosted HTTP. The fixture update is not an application mutation-route test. They do not establish atomic revocation of a request already in flight.

The next qualification extension must run alternating-host and post-write reads through a real Next server backed by an isolated synthetic database, and exercise private requests after membership revocation. It should reuse existing staging/rehearsal safety mechanisms without weakening admission or touching a provider. Until that evidence exists, the cache/runtime portion of Phase 1 remains open. Packet 16's hosted homepage qualification remains valid only for its pinned pair and original assertions.

Targeted tests, TypeScript/scoped lint and exact-head CI results are recorded on the PR/run claim. No schema, workflow, credential, infrastructure or production changes; no Phase 1 exit claim.
