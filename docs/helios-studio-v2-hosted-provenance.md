# Packet 13: non-production hosted provenance boundary

Production ON HOLD. Base #319 `b25dd0899516c5542e9fdb8cb53496246218234e`. This packet implements an executable **synthetic provider adapter**, not a live Vercel deployment client. Hosted mutation remains disabled.

## Inventory and access evidence

On September 19, 2026 the connected Vercel `list_projects` request for the previously known team returned `projects: []`, pagination count zero. This does not prove the known Helios project is absent. No safe non-production project, database binding, domain, environment-variable set or provider credential boundary could be positively identified. No production project details, environment values, deployments or databases were accessed. No Neon connector is exposed in this session. No hosted mutation was attempted.

| Boundary | Verified repository state / remaining unknown |
| --- | --- |
| Commit and CI | Draft stack, `v2-regression.yml` on codex branches; isolated release workflow produces candidate and independent compatible rollback manifests. |
| Install/build | `npm ci --ignore-scripts` in isolated CI. Package build uses `scripts/build.mjs`; it refuses VERCEL, VERCEL_ENV and HELIOS_RELEASE_TARGET before commands. Otherwise generates Prisma and builds Next. Hosted project overrides/install command remain unknown. |
| Database | Prisma CLI reads DIRECT_URL; runtime PrismaNeon uses DATABASE_URL. Their hosted bindings are unknown and were not read. Rehearsal uses fixed disposable PostgreSQL16 loopback service and synthetic configuration. |
| Migration | Only the explicit isolated classifier/admission runner executes supported migration tracks. Ordinary build no longer migrates. No resolve/repair fallback. |
| Artifact | Canonical candidate/prior JSON manifests bind candidate SHA, source revision/hash, build digest, tests, run and schema/ledger receipt. Existing artifact is audit evidence, not a deployable Vercel bundle. |
| Vercel config | vercel.json defines cron schedules only. No repository promotion/alias operation or hosted release adapter exists. Project overrides, Git integration triggers, protection settings and runtime env assignments cannot be inspected through the empty project listing. |
| Routing/rollback | Existing rehearsal routes only loopback application processes. Hosted routing, aliases, rollback metadata and immutable upload correlation remain unverified. |
| Direct builds | Repository entrypoint blocks hosted builds, unchanged here. A privileged dashboard build override or direct `next build` can bypass a repository script; provider-side enforcement is NOT claimed. |

Installed Next16.2.10 deployment/deploymentId docs were consulted. Its deploymentId is version-skew/cache metadata, not proof of source, artifact identity or routing admission. No use of caller-supplied deploymentId as provenance was added.

## Adapter and trust boundary

`scripts/release/hosted-admission.mjs` accepts only `synthetic-provider`. It has no fetch, Vercel SDK, deployment command, alias mutation or live database connection. A future authenticated provider implementation is intentionally rejected until separately reviewed access exists.

The model reads target, deployment, workflow, artifact and current migration evidence through separate provider methods. Independently pinned expected candidate and rollback records are compared to those reads. It verifies the existing #319 manifest, role-specific artifact contents/digest, source SHA, build digest, run/repository/conclusion, deployment/project/environment, admission identity, current schema/ledger receipt and an explicit one-hour maximum admission window. The target requires preview, isolated non-production classification, disposable database, synthetic credentials and no custom domains. Every routing decision must re-admit; arbitrary “previous deployment” is insufficient.

The pin is trusted reviewed orchestrator input, NOT caller environment variables. In this packet provider replies are synthetic assertions. Their fields are a normalized contract, not a claim that Vercel exposes a build digest or manifest checksum as immutable native fields. A future live adapter must retrieve authenticated immutable deployment metadata and prove the uploaded build/artifact correlation through trusted CI upload evidence. Mutable Vercel `meta` or an environment SHA alone is insufficient. SHA256 here detects mismatch, not malicious-runner forgery; no new signing infrastructure is introduced.

Provenance chain: commit → candidate-bound regression/application run → two release manifests/build digests → canonical role-specific artifact payload digest → synthetic project/deployment ID → freshly read migration receipt. The GitHub ZIP artifact digest is a separate outer transport digest; this model's canonical payload digest must not be reported as GitHub's ZIP digest. The enclosing workflow is still running during the synthetic scenario, so the simulated successful provider workflow reply is explicitly mocked, not a live completed-run lookup.

Safe audit receipts enumerate only role, admission/project/deployment IDs, environment, source/candidate SHA, run/artifact ID and digest, manifest/build/migration checksums, track and check time. Raw provider responses, credentials, URLs and errors are not persisted. Test rejection names provide the negative audit matrix without serializing arbitrary provider errors.

## Executable matrix

The actual adapter rejects wrong candidate/deployment/project/environment, missing/stale/altered manifest, role swaps both ways, changed ledger/schema receipt, unadmitted build, production inventory, custom domain, unknown database, live-provider attempt, expired/modified artifact, failed/wrong CI, wrong build and stale database read. Unit scenarios additionally verify candidate → rollback → candidate and audit field allowlisting. Existing build-entrypoint tests continue to prove hosted builds stop before commands.

`rehearse-hosted.mjs` first executes #319's real complete evidence-set validator. It then consumes the just-built current and compatible rollback manifests and performs synthetic admission/rollback/re-admission plus both substitution rejections. This supplements, rather than replaces, actual isolated PostgreSQL migrations, full application builds, HTTP and Chromium evidence. No application, migration SQL, schema, provider configuration or build guard changes are required.

## Operator procedure and stop conditions

1. Keep production release and all live hosted commands disabled. Recover the exact draft head and review this workflow/adapter.
2. Run the dedicated `V2 synthetic hosted provenance admission` workflow. Branch push/manual invocation runs only disposable PostgreSQL and mocked provider metadata, with read-only GitHub permissions and no cloud credentials.
3. Require exact-head regression, complete real release evidence set and synthetic adapter matrix success. Retain the workflow artifact and its independent GitHub transport digest for audit.
4. Do not treat `hosted-synthetic.json` as permission to upload or promote. Its mode is synthetic-only and liveDeployment/liveRollback are false.
5. For a future live rehearsal, first obtain independently verified non-production project/database/domain/environment/provider inventories. Stop on missing or ambiguous information. Then implement authenticated immutable metadata retrieval and reviewed build-upload correlation. Use manual approval and least-privilege non-production credentials. No push-triggered live deployment is enabled here.
6. Require separate admitted candidate and rollback identities and fresh DB compatibility at every simulated/real transition. Stop on any mismatch, expired evidence or inability to retrieve provenance. Never repair receipts or switch to arbitrary previous deployment.

## Verification and remaining gates

Targeted adapter suite: 26 passing tests. Initial local combined suite passed 931/931 before the additional error-redaction and missing-identity cases; expected final count is 933. Prisma7.8 generation, non-incremental TypeScript, scoped lint and whitespace passed. Final exact-head CI/test evidence is recorded on the PR and canonical run claim to avoid a self-referential documentation commit. Completion requires those checks to pass. This document does not claim a completed hosted run.

No live Vercel deployment, hosted rollback, Neon, real provider, production routing or hosted build-log redaction test occurred. Actual hosted project settings and Git integration remain unknown. The synthetic fallback satisfies the implementation path explicitly authorized for unavailable access, but the live operational gate remains OPEN. Phase1 isolation audit/hosted evidence and Phase2 media/job reliability/lifecycle gates remain open. Rollback of this code-only packet requires no data restore; all compatibility guards and media remain retained.

Recommended next packet only: safely scoped non-production project/database access inventory and authenticated provenance retrieval, followed by a separately gated live adapter rehearsal if isolation can be proved. No implementation of that packet is started.
