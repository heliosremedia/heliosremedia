# Packet 9: isolated application rollback and routing rehearsal

## Inventory before implementation

Candidate source: #315 `ad165992518283ff72a4d3c4e2e8f888adcacbcb`. Prior source: #314 `63df1f7ba403144c9858136674b11cad8d3231f0`, overlaid with the exact #315 reviewed homepage writer bundle. Raw #314 is not a rollback target. Main remains `72dab34568cb6885f3e93b5ed9db38edca156835`. No production access is part of this work.

The rollback unit is application code/binary plus a loopback routing switch. Schema and data stay in one isolated PostgreSQL database. Both revisions use the same Prisma schema; no destructive downgrade is planned. The full migration chain contains historical backfills and provider-specific operations and is not equivalent to creating an empty schema. The rehearsal distinguishes schema initialization from migration-history validation; equality of the pinned migration trees is asserted, but their SQL history is not replayed.

Production uses PrismaNeon. Disposable rehearsal copies use generated Prisma with PrismaPg against a dedicated PostgreSQL service. Authentication, current membership lookup, route handlers, transactions, parent locks, selectors and browser editors remain real. Only database transport, external font loading and provider object verification are isolated substitutions; they are not committed runtime changes. R2 signing uses synthetic configuration and no real object transport. Media objects cannot be deleted in this rehearsal.

A local proxy may target only the two loopback processes, strips any supplied forwarding headers, records the selected application identity and never forwards to a supplied URL or production host. Both public and authenticated admin requests traverse this proxy. The private organizer is not a public-layout writer. Public host resolution uses a seeded loopback domain; tenant mode remains enabled. Cookies are signed with an isolated test-only secret and current stored membership is checked by the actual application.

The repository's Vercel configuration defines crons, not a candidate routing switch. Build script checks production migration status; this rehearsal never invokes production Vercel build/deploy or cron routes. Shared-hosted cache propagation, Vercel routing and real provider behavior remain separate gates. No production environment is loaded.

Local PostgreSQL/Docker are unavailable. Installing PostgreSQL locally failed due to the environment's package-manager permission restrictions; these are not bypassed. CI's disposable PostgreSQL service supplies independent-connection evidence. Preparation/build and targeted tests can run independently. Execution results are recorded below.

## Implemented rehearsal and deliberate substitutions

`node scripts/rehearsal/application/run.mjs` refuses runtime env files and any database URL except the fixed disposable loopback service. It verifies an empty public schema before initialization. Children receive an allowlist of synthetic settings rather than inherited provider/deployment credentials. The prior source is checksum-checked before and after overlay; schema equality is asserted. Both copies use full `next build --webpack` and `next start` by default. The optional development mode is diagnostic only and must not be reported as a production-build pass.

The test-only state route requires the real signed session/current stored membership and returns only that workspace's scoped records/revisions. It is generated inside temporary copies, never added to the application repository routes. Font loading is removed only from disposable layouts. PrismaPg replaces only disposable lib/prisma.ts; provider verification accepts only the fixture's prepared work-card prefix and object deletion throws. External provider transport is not tested. The full historical migration chain is not applied: fresh schema creation and the existing registry identity trigger are explicit partial evidence.

The prior compatible application's homepage writer bundle is intentionally identical to the candidate's. Two independently built processes exercise routing/build-instance transitions; this does not certify arbitrary historical binaries. Current sessions and tenant mode remain enabled throughout. A seeded loopback public domain resolves tenant A; tenant B's data is checked for non-mutation.

The sequence checks prior → candidate → prior → candidate reads/writes, repeated same-revision project/order/layout races, headerless and stale conflicts, foreign target rejection, preparation/attachment identity, rollback attachment readback, re-promotion continuation and a real parent-row lock held by an independent connection. Chromium uses actual authenticated application editors at390/1440 and real HTTP/DB mutations across the routing switch, with external requests denied. Synthetic signed sessions are not a login-provider test.

No application behavior has been changed in this packet. Local generated Prisma and bundle preparation now pass after the initial engine download limitation; two safety tests, non-incremental TypeScript and scoped lint pass. The first corrected full application/database execution passed in CI35348994161; the strengthened harness passed in CI35349925761.

## First execution evidence and correction

CI35348420283 exercised PostgreSQL16.15, generated Prisma7.8, both complete production-mode Next16.2.10 builds/start processes, public/admin HTTP, four routing phases with project/order/layout concurrency (one200 and one409), stale/headerless/foreign rejection, canonical attachment retention and parent-lock transfer containment. Registry identity reassignment was rejected by the actual PostgreSQL trigger. No deadlock or transaction timeout occurred in those cases.

The run then failed the first Chromium locator: the harness used the standalone fixture's `Work cards editor` region, which is not present in the real application page. The harness now locates the existing `#our-work` section. No application defect or behavior change was involved. The corrected browser scenario passed in CI35348994161 at both widths; the strengthened harness also passed in CI35349925761. The strengthened browser scenario also holds a real response across routing, retains a newer edit, counts mutation requests and checks reload without replay.

A direct synthetic parent transfer is intentionally reversed by test setup before subsequent browser scenarios; this is an explicit fixture mutation, not automatic browser re-homing or backup restoration. Curation hashes are opaque revisions and layout generations are UUIDs: coherence means fresh writes invalidate prior revisions, not numerical ordering. Cache/revalidation calls run in real Next processes, but distributed CDN/asset retention and live Vercel routing are not certified.

CI35348994161 at implementation head `611566f1d858795b30c702d959f0d0b2b41949ef` passed both full builds and all real HTTP/DB checks. Actual application Chromium passed390px at13:17:42UTC and1440px at13:17:47UTC on September18,2026. The final harness adds same-revision attachment contention, a forced second-row reorder error proving atomic rollback, anonymous-auth rejection, an explicit zero-deadlock assertion and equality of the pinned migration trees. The PostgreSQL service is pinned to the exact image digest used for this successful run.

## Compatibility and routing inventory

| Boundary | Rehearsed contract |
| --- | --- |
| Source revisions | Prior #314 plus the checksum-pinned #315 homepage bundle; candidate #315. Raw prior fails the existing rollback preflight. |
| Environment | Same Node24/dependency tree and generated Prisma7.8, synthetic session secret and R2 signing values, tenant mode enabled, loopback public domain. No inherited deployment/provider credentials or runtime env files. |
| Schema/migrations | Identical source schema and migration-tree hashes. Fresh PostgreSQL schema from `db push`, plus the existing registry identity trigger. Historical migration/backfill execution remains outside this evidence. |
| Public/admin reads | Real `/` and `/admin/homepage`, plus an authenticated test-only scoped readback route. Proxy records the selected prior/candidate process on each HTTP response. |
| Project/order writers | Real `/api/admin/homepage-projects` and `/api/admin/homepage-work-cards`; current revision/request preconditions, canonical scoped acknowledgements and transactional readback remain unchanged. |
| Upload preparation | Real `/api/admin/homepage-work-cards/presign` and registry writes/signing. Synthetic object-existence verification; no transfer to R2, no deletion. |
| Private layout | Real `/api/admin/homepage-layout`; user/workspace identity and additive generation survive compatible reads and writes. Not a public layout writer. |
| Browser | Real authenticated application component and DB-backed HTTP, held acknowledgements across switches, retained newer edits, stale conflict, explicit retained copy and reload without mutation replay. |
| Cache | Real Next process cache/revalidation calls. A separate process and local proxy do not model Vercel/CDN propagation, build-asset retention or production session-key rotation. |
| Rollback unit | Application source/build and routing only. One disposable database remains in place. No schema downgrade or data restore is required for this exact pair. |

## Reproduction and rollback sequence

1. On a dedicated empty disposable PostgreSQL service, generate Prisma, initialize schema/registry trigger and seed two companies, current memberships, settings, project placements and work cards.
2. Archive both pinned application sources, retain the hardened writer bundle and assert the source/schema compatibility checks. Build each full application independently and start both on loopback.
3. Route prior → candidate → prior → candidate. In every phase verify public/admin process identity, scoped reads, revision-aware project/order/layout writes, same-revision contention and stale/headerless/foreign rejection.
4. Prepare one registered attachment, contend two same-revision attachments, read it through rollback and continue valid writes after re-promotion. The object and registry record stay retained.
5. Force a second-row reorder failure through a test-only database trigger; require HTTP500 and unchanged authoritative order/revision. Remove the fault trigger afterward.
6. Hold the project parent row on an independent connection, start the route, commit a synthetic ownership transfer and require409 after the lock releases. Return the fixture to its original parent explicitly for subsequent browser checks.
7. Load actual editors from each application revision at390px and1440px, route saves across versions, hold responses while editing, verify preserved newer input, then provoke a stale revision and reconcile by explicit retained-copy reload. No automatic retry.
8. Check bounded database deadlock count, stop both processes and dispose the CI service. Re-promotion uses the same database, without restoring data.

Run via the draft branch's `V2 isolated application rollback` workflow. A local invocation requires the exact dedicated service configured in that workflow and `PACKET9_DATABASE_URL`; the harness refuses a nonempty schema or another URL. `--prepare-only` does not constitute database/application evidence. `--dev` and `--http-only` are diagnostic options and do not satisfy this packet's final build/browser gate.

## Remaining gates and rollback limits

- This is genuine generated-Prisma/PostgreSQL/Next/Chromium execution using synthetic signed sessions. It is not hosted Neon, production PrismaNeon transport, real login/OAuth, R2/Stream, Vercel preview/candidate routing, CDN parity or production verification.
- Both builds retain the required hardened homepage bundle. Arbitrary raw historical builds remain unsupported. The checksum preflight is advisory; it is not a production deployment enforcement mechanism.
- No historical migration/backfill replay, backup restoration, tenant export/recovery, distributed routing/cache rehearsal or independent tenant-isolation review is claimed. Phase1 exit gates and Phase2 media/job reliability/lifecycle gates remain open.
- The observed lock/conflict/rollback checks are bounded correctness tests, not performance or stress certification. Opaque revisions are tested for freshness and coherence, not numerical monotonicity.
- No application defect has been reproduced in this packet. The first failure was a harness selector mismatch, corrected to the real application's existing section. Only rehearsal code, tests, a dev-only adapter dependency, CI and documents changed.
- Production remains ON HOLD. No merge, deployment, production migration, data access, provider configuration, media deletion or next-packet implementation occurred.
- Recommended next packet only: isolated historical migration/backfill and backup-restoration rehearsal against synthetic PostgreSQL fixtures, with explicit starting schemas and retained hardened writers. No implementation is started here.

## Verified implementation checkpoint, September 18, 2026

Draft [#316](https://github.com/heliosremedia/heliosremedia/pull/316), branch `codex/v2-application-rollback-rehearsal`, base `codex/v2-homepage-mixed-version` (#315). Implementation head `73588785b5b07a6e0fb8453a6eb5a6cbdab5a769`, tree `62bb548538655b2bf4df01a77f79dbb3873d19f0`, matches local implementation tree. Final documentation-head SHA and exact-head runs are recorded in the PR and canonical run claim to avoid a self-referential commit.

[Application CI35349925761](https://github.com/heliosremedia/heliosremedia/actions/runs/35349925761), job105615473553, passed every step against that implementation head:

- Generated Prisma7.8 and PostgreSQL16.15 with independent connections; both full Next16.2.10 production-mode build/start processes passed.
- Prior/candidate/rollback/re-promotion public/admin HTTP and project/order/private-layout contention passed. Each shared revision admitted one200 and one409. Stale/headerless writers were409, a foreign project404, anonymous access401.
- Attachment contention admitted one200 and one409 against one prepared registry asset. Canonical identity and rollback readback passed; object verification remained synthetic.
- Forced second-row reorder error returned500 and preserved the prior authoritative order/revision. Parent lock blocked the route until transfer committed, then returned409. No transaction timeout occurred; PostgreSQL reported zero deadlocks for this bounded run.
- Actual application Chromium passed prior-loaded390px13:26:47UTC, prior-loaded1440px13:26:52UTC, candidate-loaded390px13:26:57UTC and candidate-loaded1440px13:27:02UTC. Real DB-backed saves crossed routing boundaries; delayed receipts preserved newer edits, stale state retained a copy and explicit reload reconciled without retry.
- No schema rollback, destructive downgrade, database restoration or object deletion was required. The same isolated database persisted through all routing phases.

Local final combined regression suite passed **883 tests, zero failures**. Generated Prisma, driver preparation/bundle, non-incremental TypeScript, scoped lint and whitespace passed. Full regression workflow evidence is recorded with the final checkpoint below. The CI rehearsal adds integration assertions beyond the883 Node tests; they are not counted as additional unit tests.

[Regression CI35349925691](https://github.com/heliosremedia/heliosremedia/actions/runs/35349925691), job105615446250, passed every step against the same implementation head:883 tests, zero failures, Prisma generation, non-incremental TypeScript, all existing recovery fixture builds/Chromium checks, isolated Studio Next HTTP/Chromium and whitespace. **Packet9 is complete for this bounded isolated rehearsal and ready for roadmap review**, with the limitations above. Final documentation-only commit receives its own exact-head verification; those run IDs and final head are recorded on the PR and canonical claim. No next packet is started.
