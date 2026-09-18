# Packet 9: isolated application rollback and routing rehearsal

## Inventory before implementation

Candidate source: #315 `ad165992518283ff72a4d3c4e2e8f888adcacbcb`. Prior source: #314 `63df1f7ba403144c9858136674b11cad8d3231f0`, overlaid with the exact #315 reviewed homepage writer bundle. Raw #314 is not a rollback target. Main remains `72dab34568cb6885f3e93b5ed9db38edca156835`. No production access is part of this work.

The rollback unit is application code/binary plus a loopback routing switch. Schema and data stay in one isolated PostgreSQL database. Both revisions use the same Prisma schema; no destructive downgrade is planned. The full migration chain contains historical backfills and provider-specific operations and is not equivalent to creating an empty schema. The rehearsal will explicitly distinguish schema initialization from migration-history validation.

Production uses PrismaNeon. Disposable rehearsal copies use generated Prisma with PrismaPg against a dedicated PostgreSQL service. Authentication, current membership lookup, route handlers, transactions, parent locks, selectors and browser editors remain real. Only database transport, external font loading and provider object verification are isolated substitutions; they are not committed runtime changes. R2 signing uses synthetic configuration and no real object transport. Media objects cannot be deleted in this rehearsal.

A local proxy may target only the two loopback processes, strips any supplied forwarding headers, records the selected application identity and never forwards to a supplied URL or production host. Both public and authenticated admin requests traverse this proxy. The private organizer is not a public-layout writer. Public host resolution uses a seeded loopback domain; tenant mode remains enabled. Cookies are signed with an isolated test-only secret and current stored membership is checked by the actual application.

The repository's Vercel configuration defines crons, not a candidate routing switch. Build script checks production migration status; this rehearsal never invokes production Vercel build/deploy or cron routes. Shared-hosted cache propagation, Vercel routing and real provider behavior remain separate gates. No production environment is loaded.

Local PostgreSQL/Docker are unavailable. Installing PostgreSQL locally failed due to the environment's package-manager permission restrictions; these are not bypassed. CI's disposable PostgreSQL service is the planned independent-connection evidence source. Preparation/build and targeted tests can run independently. Full execution results will be recorded below.

## Implemented rehearsal and deliberate substitutions

`node scripts/rehearsal/application/run.mjs` refuses runtime env files and any database URL except the fixed disposable loopback service. It verifies an empty public schema before initialization. Children receive an allowlist of synthetic settings rather than inherited provider/deployment credentials. The prior source is checksum-checked before and after overlay; schema equality is asserted. Both copies use full `next build --webpack` and `next start` by default. The optional development mode is diagnostic only and must not be reported as a production-build pass.

The test-only state route requires the real signed session/current stored membership and returns only that workspace's scoped records/revisions. It is generated inside temporary copies, never added to the application repository routes. Font loading is removed only from disposable layouts. PrismaPg replaces only disposable lib/prisma.ts; provider verification accepts only the fixture's prepared work-card prefix and object deletion throws. External provider transport is not tested. The full historical migration chain is not applied: fresh schema creation and the existing registry identity trigger are explicit partial evidence.

The prior compatible application's homepage writer bundle is intentionally identical to the candidate's. Two independently built processes exercise routing/build-instance transitions; this does not certify arbitrary historical binaries. Current sessions and tenant mode remain enabled throughout. A seeded loopback public domain resolves tenant A; tenant B's data is checked for non-mutation.

The sequence checks prior → candidate → prior → candidate reads/writes, repeated same-revision project/order/layout races, headerless and stale conflicts, foreign target rejection, preparation/attachment identity, rollback attachment readback, re-promotion continuation and a real parent-row lock held by an independent connection. Chromium uses actual authenticated application editors at390/1440 and real HTTP/DB mutations across the routing switch, with external requests denied. Synthetic signed sessions are not a login-provider test.

No application behavior has been changed in this packet. Local generated Prisma and bundle preparation now pass after the initial engine download limitation; two safety tests, non-incremental TypeScript and scoped lint pass. The first corrected full application/database execution passed in CI35348994161; final strengthened-harness verification is pending.

## First execution evidence and correction

CI35348420283 exercised PostgreSQL16.15, generated Prisma7.8, both complete production-mode Next16.2.10 builds/start processes, public/admin HTTP, four routing phases with project/order/layout concurrency (one200 and one409), stale/headerless/foreign rejection, canonical attachment retention and parent-lock transfer containment. Registry identity reassignment was rejected by the actual PostgreSQL trigger. No deadlock or transaction timeout occurred in those cases.

The run then failed the first Chromium locator: the harness used the standalone fixture's `Work cards editor` region, which is not present in the real application page. The harness now locates the existing `#our-work` section. No application defect or behavior change was involved. The corrected browser scenario passed in CI35348994161 at both widths; final strengthened-harness CI remains pending. The strengthened browser scenario also holds a real response across routing, retains a newer edit, counts mutation requests and checks reload without replay.

A direct synthetic parent transfer is intentionally reversed by test setup before subsequent browser scenarios; this is an explicit fixture mutation, not automatic browser re-homing or backup restoration. Curation hashes are opaque revisions and layout generations are UUIDs: coherence means fresh writes invalidate prior revisions, not numerical ordering. Cache/revalidation calls run in real Next processes, but distributed CDN/asset retention and live Vercel routing are not certified.

CI35348994161 at implementation head `611566f1d858795b30c702d959f0d0b2b41949ef` passed both full builds and all real HTTP/DB checks. Actual application Chromium passed390px at13:17:42UTC and1440px at13:17:47UTC on September18,2026. The final harness adds same-revision attachment contention, a forced second-row reorder error proving atomic rollback, anonymous-auth rejection, an explicit zero-deadlock assertion and equality of the pinned migration trees. The PostgreSQL service is pinned to the exact image digest used for this successful run.
