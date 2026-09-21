# Packet 16: authenticated Neon baseline, bootstrap execution blocked

September 20, 2026. **INCOMPLETE. No database mutation or deployment performed.** Base #322, `codex/v2-hosted-access-owner-action`, head `ba964b856614ce9d4279a99fb5e4c83cd0da5c3c`. Main remains `72dab34568cb6885f3e93b5ed9db38edca156835`. Production ON HOLD.

## Authenticated target and empty baseline

The newly available Neon connector returned project `calm-shape-83359560`, name `helios-v2-staging`, organization `org-nameless-shape-94202911`, region `aws-us-west-2`, PostgreSQL major16 and effective project permission ADMIN. Branch discovery returned `br-young-math-arj7l4r3`, name `main`, ready, under that exact project. The owner explicitly authorized this newly created empty staging target; branch name `main` alone is not an environment classification.

Read-only SQL was explicitly addressed to that project, branch and database `helios_v2_staging`. It returned PostgreSQL `16.15 (eb11870)`, zero user relations, no `_prisma_migrations`, zero public relations/functions/types, zero additional non-system schemas, zero additional extensions beyond plpgsql, and zero event triggers. These are fresh authenticated catalog observations, not a synthetic fixture. No application tables exist, so there are no application/customer rows. No production database was queried.

The database is empty and eligible for evaluation of the clean-bootstrap track. A successful full #318 classifier/postflight is NOT claimed. No target-derived catalog was substituted for the independently pinned expected V2 schema.

## Execution blocker

Connector SQL access works, but local direct PostgreSQL access does not: DNS lookup of both the returned pooled endpoint and its direct counterpart fails with `EAI_AGAIN` / temporary failure in name resolution before TCP connection. This is an execution-environment network failure, not a Neon permission or database failure. The connector returned a privileged connection URI, which was retained privately for inspection, never printed, committed or written to the checkout. It was not used to mutate the database. The returned URI was pooled; migrations require independently verified direct endpoint configuration.

Dependency installation succeeded with `npm ci --ignore-scripts`. Actual `prepareArtifact` from #318 was attempted without any target database connection. Prisma's schema-engine acquisition failed resolving `binaries.prisma.sh` with EAI_AGAIN. Thus baseline artifact generation itself did NOT finish. Historical SQL was not replayed through the connector as a substitute. No db push, resolve, checksum change, migration reorder, schema patch or failed migration row was created.

Independent local integrity checks passed for all106 immutable migration files and exact directory membership. Prisma schema checksum is `ede3650c4b65f8704a125672ed32f7b7110a78a83cdacf14744e6419d02a0892`; migration-manifest checksum is `8cb9e5d72af3c2353018a3099d14172794e165a5e54ee11b02e80c46a5e6437a`. These are source checks, NOT target-schema equivalence. The reviewed baseline checksum remains `6eb3e3af3536ec58df86fcdf5739c2b07dc1664263410c06ceed012c6c6e3dbb`; it was not freshly reproduced here.

## Resume procedure, no manual UI improvisation

1. Supply an approved execution environment able to reach the verified Neon DIRECT endpoint on PostgreSQL/TLS and obtain the pinned Prisma7.8 schema engine. Alternatively use a protected, manually dispatched staging-only CI runner with the staging direct URL injected through secure environment secrets. Do not paste credentials into chat, add them to public workflow arguments, or use production credentials.
2. Recheck exact provider project/branch/database identity and empty state immediately before mutation. The observations above are time-bound. Abort if identity or state differs.
3. Implement/review a narrowly scoped staging executor binding these authenticated identities to the #318 immutable artifact and #319 admission/source checks. Existing `databaseUrl`, `requireDatabase`, `prisma`, release preflight and application harness intentionally accept fixed loopback targets only. Leave those protections intact; do not rewrite the connection URL, spoof loopback, or remove their checks to make staging pass. The current hosted build guard stays closed.
4. Generate the baseline plus18 byte-identical V2 migrations. Verify the independently pinned baseline checksum/reference catalogs, then execute actual Prisma deploy of the clean track. No historical data repair replay, automatic resolve or guessed ownership mapping.
5. Verify current-compatible baseline ledger, full expected catalog including SQL-only guards, repeated no-op deployment, synthetic-only two-tenant seed, actual runtime isolation/revision/concurrency and unchanged ledger. Only then build candidate evidence through the reviewed staging gate.
6. Any failure preserves evidence and stops. No automatic destructive reset or migration repair. No backup restore is required for this attempt because no mutation occurred.

## Results and remaining gates

No bootstrap, post-bootstrap fingerprint, synthetic seed, real Neon application isolation, candidate build/release manifest, hosted HTTP/Chromium or rollback result exists yet. No fresh full regression/TypeScript/Prisma generation/CI run is claimed. This documentation-only checkpoint validates whitespace and immutable source checks; previous968-test CI remains inherited #321 evidence, not Packet16 verification.

Vercel `helios-v2-staging` separation and environment bindings are owner-reported. They were not independently retrieved in this run. The known connector visibility/provenance gate remains open. No Vercel project, domain, alias, environment variable or deployment was changed. No provider side effects, production resources or customer data were used.

Packet16 remains OPEN. Next action is to resume THIS packet in an approved network-capable staging runner, including its scoped execution/admission implementation. Do not begin another roadmap packet, hosted cutover or white-label onboarding.

## Resume: protected manual executor implementation

`v2-neon-staging-bootstrap.yml` is workflow_dispatch ONLY. It has no push/PR trigger, Vercel call, deployment, seed or production command. Fixed concurrency disables cancellation of an active migration. The exact reviewed SHA must equal the dispatched branch HEAD. Its job references GitHub Environment `helios-v2-staging-bootstrap`; the executor independently reads the environment policy and refuses absent owner required-reviewer protection, administrator bypass, or anything other than the one exact allowed branch `codex/v2-neon-staging-bootstrap`. Unknown protection/API access stops before DB connection. Environment protection is not established by merely naming an environment in YAML.

The job first runs the full credential-free regression, generated Prisma/types/scoped lint and #319 real disposable PostgreSQL reference/migration matrix. Only the final guarded step receives staging secrets. It authenticates exact Neon project/org/region/PG version, branch and database metadata, matches the DIRECT URI hostname to that branch's read-write endpoint, enforces verified TLS, rechecks database/version, acquires the existing cooperating-release advisory lock, validates immutable artifact/reference/source identity, and runs the actual Prisma baseline deploy only after clean-bootstrap or current-baseline admission. Fresh postflight requires exact schema/ledger classification, followed by a second no-op deploy. Failed/partial states never retry/resolve automatically. Raw provider/Prisma errors are suppressed to avoid credential leakage. Success uploads only allowlisted IDs/hashes and explicitly marks applicationVerified/deployable false.

No existing loopback helper, hosted build guard, SQL migration or public application is altered. This executor completes only the bootstrap/postflight stage of Packet16; synthetic tenants, actual Neon application isolation/concurrency, candidate build and hosted qualification still follow separately within Packet16. The new credential-free contract workflow and tests do not constitute hosted bootstrap evidence.

### Required owner setup before manual execution

- Create/verify GitHub Environment `helios-v2-staging-bootstrap`: required User reviewer `heliosremedia`, administrator bypass disabled, selected deployment branch only `codex/v2-neon-staging-bootstrap` (no tag policy). Review the exact SHA before approving the job. Self-review prevention is an optional stronger policy when another reviewer/operator exists.
- Store ONLY staging secrets in that environment: `STAGING_DIRECT_URL` (direct, sslmode=require, exact database) and `STAGING_NEON_API_KEY` with read metadata access for the isolated staging project. Never use repository-wide production secrets. If the default GitHub token cannot read environment policy, supply `STAGING_GITHUB_READ_TOKEN` with repository Environments read access only. A denied metadata response blocks execution.
- GitHub requires a workflow_dispatch workflow on the default branch before manual dispatch. The new workflow is on draft #323 only. Registering it on main requires a separately reviewed workflow-only change and approval because merges/main changes remain prohibited and Vercel Git integration reacts to commits. Do not merge the V2 stack to register a workflow. No default-branch change was performed.
- Available connector capabilities cannot configure GitHub environments/secrets or dispatch a new workflow. An authorized account owner must configure those controls and dispatch the exact reviewed branch SHA after registration. No raw credentials belong in chat.
- Select `clean-bootstrap` for the newly empty database, or `current-baseline` only for a previously fully verified bootstrap. Confirmation is the exact `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging`. If any earlier attempt left a partial ledger, stop for review.

GitHub references: [manual dispatch default-branch requirement](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

### Why both Vercel projects reacted

Authenticated GitHub status for `3453f854fae9630c16b0753582735dd8166fd6c3` reports failures for BOTH `Vercel – heliosremedia` and `Vercel – helios-v2-staging`. The vercel[bot] #323 comment identifies projects `prj_FPZa82WCG2w4oxJzf7DEV04ChuWB` and `prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg`, with separate deployment links and empty preview URLs. This establishes Git integration fan-out for the PR commit, despite [skip ci] and a documentation-only diff. GitHub Actions skip directives did not prevent those provider reactions.

Staging deployment metadata lookup using the supplied dashboard deployment identifier returned404 through the connector. Build logs/target/environment/routing could not be verified, so the cause of each build failure and any production alias effect remain unproven. The checked-in hosted guard rejects Vercel builds before Prisma/Next commands, but dashboard overrides and install-time behavior were not inspected. A production-project reaction must not be equated with production promotion. No settings, aliases, domains, Git integration, ignored-build rules or production environment values were changed. Recommended owner review: inspect each project's Git branch/preview triggers and build settings; any production-project change needs Jake's separate approval.

## Packet 16 continuation: protected tenant qualification (September 21, 2026)

Database baseline is now VERIFIED at candidate `513f5eb94c963c2d33929604f56cc5f7107de483`, manual run35549161614 attempt2: real Neon bootstrap/postflight and repeated migration no-op passed,994/994 tests. Independent authenticated readback: PostgreSQL16.15,114 public tables,19 completed migration rows,zero workspaces. This supersedes the historical blocked observations below. Bootstrap receipt artifact10617918204 was retained by CI; its archive contents were not independently downloaded here.

Authenticated Vercel browser sign-in now succeeds. Staging project ID `prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg` is visible under Helios Real Estate Media. Domain inventory shows only `helios-v2-staging.vercel.app`, with No Deployment. Build suppression remains `exit 0` (UI labels this “Don’t build anything”). No setting changed. This is authenticated UI evidence, not immutable deployment/API/upload provenance. Production was not opened or modified.

New draft-only tenant executor uses a separate manual workflow, existing protected environment and exact Neon target policy. It performs no migration or deployment. It requires current-baseline classification, fresh candidate-bound tests/source evidence, explicit seed confirmation and unchanged catalog/ledger after qualification. Atomic seed creates exactly two synthetic workspaces, passwordless owner identities/memberships, scoped settings, published synthetic projects/homepage placements and reserved `.example.test` public mappings. Unknown/non-fixture data blocks without repair. Repeat execution validates identities and footprint before using existing fixtures.

Qualification bundles actual session verification, public host resolution, settings readers, curation snapshot and homepage PATCH route with generated Prisma/PrismaPg. Only Next request context/cache/navigation and Prisma construction are adapted. It tests both tenant directions, foreign404, parallel200+409, stale409, authoritative revision readback, unknown-host rejection, anonymous403 and unchanged other-tenant placement. No provider adapters are invoked. This is route/service execution, not hosted HTTP/browser or the deployed PrismaNeon transport.

Verification: implementation under review; fresh isolated PostgreSQL CI and final evidence pending. Existing bootstrap workflow and all application/release guards unchanged. New manual workflow is NOT yet registered on default branch or dispatched. Live tenant seed and hosted qualification remain outstanding. Registration is a separate narrowly scoped owner-reviewed action; do not merge the V2 stack. No staging build-setting approval is requested yet because hosted admission is not ready. Packet16 OPEN; no Packet17.

### Tenant executor operator procedure

1. Review the exact PR323 candidate and credential-free tenant contract CI. Do not reuse the bootstrap candidate SHA for changed source.
2. Separately review/register only `.github/workflows/v2-neon-staging-tenants.yml` on the default branch for discovery. This does not merge application code or authorize a Vercel deployment.
3. Dispatch on `codex/v2-neon-staging-bootstrap`, candidate equal to exact reviewed head, track `current-baseline`, confirmation `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging`, tenant_confirmation `seed-synthetic-tenants-only`. Required owner environment approval remains enforced; no bypass.
4. No other operator should write staging during qualification. The cooperating advisory lock serializes this executor with bootstrap, not arbitrary external writes.
5. Inspect the safe `tenant-neon.json` receipt. Require exact candidate/target, all two-direction checks, unchanged schema/ledger, and remember deployable/hostedApplicationVerified remain false.
6. If seed transaction fails it rolls back; if later qualification fails, synthetic fixtures may remain. Do not delete/reset/repair automatically. Review state and failure before separately authorizing another dispatch. Successful reruns validate the same fixture footprint; they never recreate identities or reset revisions.
7. Retain synthetic records for subsequent hosted qualification. No media or providers are seeded. The `.example.test` mappings intentionally do not authorize a Vercel deployment host. Actual staging-domain binding, secure hosted test-session transport, admitted build/deployment correlation, HTTP/Chromium and rollback are still required.

The executor is not a general seed CLI and cannot operate on production. The isolated CI counterpart uses the existing fixed loopback PostgreSQL target and verifies repeatability without live credentials. No historical migrations, schema, old writers or release admission controls change.
