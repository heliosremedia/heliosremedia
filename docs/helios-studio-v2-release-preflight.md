# Packet 12: deployment-track preflight and release artifacts

Production ON HOLD. Isolated implementation; final evidence is recorded below and on the draft PR. Stacked on #318 `f53239ae6a80d9c8afa20c72b5e89dfd5dc233cf`. No hosted credentials, deploy, production database, routing or provisioning.

## Deployment inventory and reproduced gap

| Stage | Existing path and environment | Packet 12 boundary |
| --- | --- | --- |
| Source → CI | V2 regression runs for codex branches/main; three dedicated PostgreSQL rehearsals run only their packet branches or manually. Read-only GitHub token; no deployment secrets. | Dedicated `v2-release-preflight.yml`, packet branch/manual only, same pinned PG16 service. |
| Build | `npm run build` calls `scripts/build.mjs`; Prisma generate then Next build. Previously production first ran canonical `prisma migrate status`. | Ordinary local build remains a developer build, not a release artifact. Hosted Vercel builds are explicitly blocked before any command while a hosted gate adapter remains unverified. |
| Migration | `prisma.config.ts` loads dotenv and DIRECT_URL, canonical migrations. Operator commands and isolated Packet11 helpers can run deploy/resolve separately. | New release executor uses fixed loopback URLs, verified generated configs and selected track. No db push, automatic resolve, repair or fallback. Historical tooling is not deleted. |
| Runtime | DATABASE_URL, PrismaNeon in real app; generated PrismaPg in isolated harness. Next may load env files and freezes public env at build. | Harness refuses runtime env files; subprocesses use synthetic allowlisted environment and loopback-only providers/fonts. |
| Artifact | Existing harness builds pinned copies, with no migration-state/build receipt. | Current HEAD and compatible rollback copy each receive source/build/schema/ledger/test identity and separate machine-readable manifest. |
| Routing/promotion | No repository GitHub Vercel deploy/promotion workflow. vercel.json defines existing crons. External project Git integration/settings and approval gates are not inspected in this packet. | Loopback proxy waits for admission and revalidates before each switch. No provider or production routing. |

Executable baseline: the actual prior build script executed migrate status → generate → build with mocked successful status despite no classified release evidence. Added assertion expected a stop and failed (undefined exit versus1). This proves the missing admission gate, not that an actual production database was unsafe. Existing #318 tests already prove schema/ledger drift classification. No historical migration SQL changes.

## Explicit migration tracks

| Selected track | Required initial classification | Command / outcome |
| --- | --- | --- |
| clean-bootstrap | empty, clean-bootstrap-candidate | Actual Prisma deploy of reviewed baseline + identical18 V2 migrations; then current-baseline. |
| verified-baseline | supported-historical-ledger with the one reviewed baseline | Actual baseline-directory deploy; then current-baseline. |
| historical-ledger | supported-historical-ledger with all88 original entries/checksums | Actual canonical deploy; preserve original ledger; then current-historical. |
| current-baseline | current-compatible-ledger / baseline | No pending unexpected migration; repeat deploy is no-op. |
| current-historical | current-compatible-ledger / historical | No pending unexpected migration; repeat deploy is no-op. |
| no ledger | verified-historical-without-ledger | Diagnostic eligibility only. BLOCKED until a separately reviewed baseline establishment; this release path never calls migrate resolve. |
| anything else | unknown, partial, failed, rolled-back, missing/duplicate/checksum/schema drift, missing guards | BLOCKED before migration/build/admission. |

A no-ledger database is not silently converted. The rehearsal proves rejection and uses an independently, actually deployed single-baseline fixture to represent the supported post-establishment state. It does not fake applying historical DML or run resolve. Pending historical brand rows require a separately reviewed ownership plan and are conservatively blocked before any migration, even if a session/database mapping setting exists. This avoids failing midway through the18-file expansion or guessing ownership. Already-current compatibility rows remain subject to the separate Phase1 data-readiness/backfill gates. The existing-original-ledger fixture is explicitly synthetic, as in #318; actual deployed Helios history remains unknown.

## Enforcement and integrity

`release/gate.mjs` uses #318's read-only repeatable-read classifier. It pins the reviewed106-file manifest, bootstrap SQL checksum, historical/current PostgreSQL catalogs, Prisma schema checksum and Prisma7.8/client versions. It checks canonical SQL, expanded baseline SQL, exact migration-directory membership and executable Prisma config contents before connecting/migrating. No unexpected pending SQL may enter the artifact. Candidate must equal checkout HEAD. Database URLs are fixed disposable loopback values; the gate refuses hosted target markers.

A cooperating release holds a database advisory lock through preflight/deploy/postflight. Prisma runs only after fresh preflight; its result must become current-compatible. Repeated preflight/deploy preserves ledger. This serializes this executor, not arbitrary external SQL: schema writers must be quiesced. No hosted lock/DDL privilege policy is claimed.

`application-gate.mjs` wraps the real #316 application harness. Before each build it rechecks the database and compares the generated client's formatted inline schema to the input schema. Candidate source is actual current HEAD, not the old #316 pin. Rollback is #314 plus the unchanged checksum-pinned #315 writer bundle. Both include the established synthetic transport/font/auth fixture substitutions, captured by a source-content digest. No app route is added to the committed application.

The manifest is canonical JSON with:

- format version and explicit isolated target;
- candidate SHA, source revision, effective source digest;
- immutable migration manifest, baseline version/checksum, schema/lockfile/Prisma identity;
- final database classification, migration track, schema hash, ledger hash and synthetic DB name;
- successful build status and output digest;
- candidate-bound Node regression count/status and actual application smoke result;
- CI run identity and canonical payload checksum.

The output digest includes Next build output except cache, trace and diagnostic files. Source digest excludes dependencies and build/type-generated files. Same inputs serialize identically; independent builds may differ. Secrets, URLs/passwords, sessions and customer data are not in manifests. These are CI audit receipts, not cryptographic signatures against a malicious runner. Trusted checkout/workflow and protected future artifact provenance remain required.

Each application passes authenticated scoped smoke and anonymous rejection before receiving a manifest. The proxy has no listening routing path until prior admission succeeds. Every routing switch checks the on-disk receipt against independently retained expected source/tests/CI identity, recomputed build hash and fresh database classification. A digest recomputed over forged/stale content is insufficient. Prior artifact has its own source/build identity; current receipt cannot be used for rollback. Full route/browser results are a separate postflight artifact, not inferred from a successful build. A final executable evidence-set check requires both manifests and the completed application/browser result; omitting release mode cannot accidentally pass artifact publication.

Hosted `scripts/build.mjs` now fails closed for VERCEL/VERCEL_ENV/release-target builds. It does not offer a bypass flag. This is a draft-branch code change only; deployed main is untouched. A future hosted adapter and Jake's release decision must be reviewed before this stack can be merged/deployed. Calling raw Next/Prisma manually is not the supported gated release path; repository code cannot enforce cloud dashboard overrides or administrator shell access.

## Executable matrix and run procedure

1. Use dedicated workflow with no secrets and disposable PG16. Refuse pre-existing databases and runtime env files.
2. Run full regression and bind results to checkout SHA. Generate Prisma, check non-incremental types/scoped lint.
3. Generate reviewed baseline/reference independently; validate against pinned catalog hashes and current Prisma model (retaining enumerated DB-only guards).
4. Exercise clean, verified-baseline and original-ledger expansion through real preflight/deploy; current-track repeats are no-ops.
5. Commit isolated checksum, failed/missing/unknown/duplicate ledger, schema drift and missing-guard faults; actual independent-connection migration executor must reject while ledger and schema stay unchanged. Explicit fixture restoration happens only after assertions.
6. Reject wrong track/SHA/baseline checksum. Actually interrupt Prisma baseline with a test event trigger; remove the injector and prove the failed ledger cannot be retried/resolved by the executor.
7. No-ledger exact schema and missing-guard schema remain blocked without any ledger creation. Backfill only synthetic two-company data with the existing operators; logical-copy the approved DB for the application.
8. Build/start both complete apps, qualify separate manifests, reject every stale/mismatched evidence field and swapped rollback receipts. Admit local routing and exercise actual admin/public reads, revision-aware writes, tenant isolation, parent contention and browser recovery.
9. Reinspect schema/ledger and build identity after execution. Upload only safe JSON evidence with candidate-bound artifact name and30-day retention. Dispose the isolated service.

Run expensive gate for an intended release candidate or changes to migrations/schema/release machinery, not every trivial product branch. It is explicitly branch-scoped/manual here. Future release CI should require this exact candidate evidence before deployment; no normal hosted deployment gate is claimed installed.

## Verification and remaining gates

Final counts, workflow links and Chromium results will be recorded after exact-head CI. Local targeted policy/build tests exercise admission, deterministic receipts, recomputed stale receipt rejection, artifact content tampering and unsupported environments.

Remaining: actual deployed ledger/schema inventory (read-only and separately authorized), hosted Neon/PrismaNeon transport, direct/pooled privilege and DDL-quiescence policy, cloud-enforced artifact provenance/approvals, Vercel non-production promotion/CDN/session behavior, production backup/PITR and explicit Jake QA/release decision. No production readiness, provisioning or general Phase1/2 completion is claimed.

Rollback of this packet is code-only in drafts; isolated receipts become invalid when their expected code/config/ledger changes. No schema or data downgrade is introduced, compatibility guards remain, and no media is deleted. Raw historical writers remain unsupported. Recommended next packet only: explicitly non-production hosted deployment-adapter and artifact-provenance inventory, gated on available access. Not started.

## Verified implementation checkpoint, September 19, 2026

Draft [#319](https://github.com/heliosremedia/heliosremedia/pull/319), branch `codex/v2-deployment-track-preflight`, base #318 `codex/v2-migration-ledger-bootstrap`. Implementation checkpoint `34dddc81bfe4c5dd90ccb026a7dd3d39e36a220d`, tree `d4f1e72463dccce78e5122a2e5e54569d0dc05e7`.

[Dedicated release CI35420890770](https://github.com/heliosremedia/heliosremedia/actions/runs/35420890770), job105838256184, passed every step:

- PostgreSQL16.15, actual Prisma7.8 and pinned immutable baseline. Clean, established-baseline and original-ledger expansion passed, with unchanged historical entries and repeated no-op current deploys. Full reference/current Prisma catalog equivalence passed.
- All committed unsafe ledger/schema/guard fixtures, wrong track/candidate/baseline, exact no-ledger and actual interrupted Prisma bootstrap were denied without automatic repair, resolve or migration advancement.
- **907 tests passed, zero failed**, generated Prisma, non-incremental TypeScript and scoped lint passed. Local full907, targeted15, generation/types/lint and whitespace passed too. Local annotations were corrected for JS-to-TS inference; the initial generated-client byte comparison was corrected to use actual Prisma formatting because the generator canonicalizes schema layout. No schema semantics changed.
- Actual prior-compatible and current-HEAD full Next builds/start passed. Separate source/build/ledger/test-bound manifests admitted loopback prior → candidate → rollback → candidate. Stale/recomputed/swapped artifact identities were rejected. Schema and migration ledger remained stable through use.
- Real synthetic-authenticated admin legal/location reads and two public hosts remained isolated. Foreign removal404, stale/headerless409, same-revision writes200+409, canonical attachment retention, atomic reorder rollback and parent-lock transfer fencing passed. Zero observed deadlocks is bounded correctness evidence only.
- Actual application Chromium passed prior-loaded390px04:24:22UTC, prior-loaded1440px04:24:26UTC, candidate-loaded390px04:24:30UTC and candidate-loaded1440px04:24:33UTC. Held acknowledgements preserved newer input; stale conflict retained a copy; explicit reload did not retry writes.
- Safe JSON manifests/track/test/application evidence uploaded under the exact candidate artifact name, with30-day retention.

Final review adds dirty-checkout refusal, actual on-disk swapped-manifest admission negatives, the complete evidence-set publication check, and conservative pre-migration rejection of historical brand records requiring ownership review. These refinements receive fresh exact-head CI. Final head and both exact-head runs are recorded on #319 and the canonical run claim, avoiding self-referential documentation commits. Packet12 is complete for the bounded isolated gate/artifact scope only after those checks pass. No hosted adapter, production release or next packet is authorized by this evidence.
