# Packet 16: protected Actions hosted qualification executor

Status: registered workflow-only on main at b6fb99e9a5ffe5b30c6d7b538cb79861e4fa6199. First approved live run35563010507 attempt1 stopped at preflight; no admission, configuration or deployment occurred. This correction is diagnostics-only and has NOT been dispatched live.

## Two immutable identities

The application candidate is **64af9c6462d5fb5254ef3a40b6a80b14b63594e7**, with successful regression run35564228593. The executor is a newer separately reviewed PR323 commit. Workflow inputs must pin both; Actions checks out the candidate separately and verifies its Git identity. The Vercel API request uses the original candidate SHA, never the executor head or latest branch tip. No application source overlay or build-command override is supplied.

The deployed candidate now includes the reviewed hosted-build phase/reason diagnostics. This pin changes only the deployed source identity and its bound exact-SHA regression evidence; the schema, ledger, provider, target and production-rejection predicates remain unchanged.

## Registration and secrets

After owner review, register ONLY `.github/workflows/v2-vercel-staging-qualification.yml` on main for workflow_dispatch discovery. No stack merge. Dispatch from `codex/v2-neon-staging-bootstrap` using the exact reviewed executor SHA, fixed candidate SHA, current-baseline (hardcoded), target confirmation `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging`, and `deploy-preview-and-qualify-synthetic-tenants-only`.

The existing `helios-v2-staging-bootstrap` Environment must retain owner review, no administrator bypass and exact branch restriction. Shared concurrency group serializes bootstrap/tenant/hosted runs. Live secrets appear only in the protected execution step; no push trigger exists.

Secret names: `STAGING_VERCEL_TOKEN`, `STAGING_DIRECT_URL`, `STAGING_NEON_API_KEY`. `STAGING_GITHUB_READ_TOKEN` is required if github.token cannot read Environment protection metadata or the candidate CI run. Optional `STAGING_VERCEL_BYPASS_SECRET` is used only if owner-provisioned Preview protection requires it. The executor does not disable protection. AUTH_SECRET is freshly generated in memory per run, never logged or uploaded.

## Provider path and temporary changes, all pending approval

Authenticated GETs inspect ONLY staging project `prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg` under team `team_H79eaUfq9xMqcbf34ZCtwwn9`. No request identifies or mutates the production project. Require Git linkage, production branch different from V2 branch, system variables exposed, no root/output override, standard build/install settings, `exit 0`, no custom environment/suffix, and only the staging default domain. Unknown project configuration fails closed.

Existing project variable names must be only DATABASE_URL/DIRECT_URL with no branch override. Add encrypted, branch-specific **Preview-only** values for the fixed candidate, run, staging URLs, generated auth secret, tenant flag, admission credentials and project/team IDs. No production-target variable is written. Rows carry a unique Actions run marker; cleanup removes only rows with that marker, branch and Preview target, including rows created by an uncertain variable-create response. No broad secret copying. Native candidate build needs authenticated GET credentials, so those staging-only values are present in that Preview deployment's captured environment. Deleting project configuration afterwards does not erase the deployed environment snapshot; scoped token lifetime/revocation remains an operator consideration.

Temporarily set staging's ignore command to allow only Preview with the fixed candidate SHA, then POST exactly once to `/v13/deployments?teamId=...` with staging project and Git source SHA/ref/repo ID. Target omitted means Preview in Vercel's API. No `withLatestCommit`, deploymentId redeploy, files, migrations, promote or production target. Bounded polling validates identity at every read. Any POST uncertainty fails without automatic redeployment.

The native candidate admission still verifies Vercel/GitHub/Neon metadata, builds without migrations, emits a checksummed build receipt and checks unchanged schema/ledger. The executor retrieves all available build events and validates exactly one receipt against candidate/deployment/project/team/CI/schema/ledger/build digest before HTTP qualification. Raw events and response bodies are NOT artifacts. Safe diagnostics retain ordered event type, classified reason and detail hash for every returned event; HTTP failures retain status codes. Missing logs/receipt fail closed, not false success. This is provider build-receipt correlation, not independent byte attestation of Vercel's final function package.

API schema references: https://vercel.com/docs/rest-api/deployments/create-a-new-deployment and https://openapi.vercel.sh (inspected during implementation). No undocumented deployment env payload or CLI bypass is used.

## Database and browser qualification

Authenticated Neon metadata pins project calm-shape-83359560, branch br-young-math-arj7l4r3, database helios_v2_staging, PostgreSQL16 and the established endpoint/TLS policy. Read-only catalog/ledger classification must match current baseline. Existing synthetic footprint must contain exactly two rows in the seven fixture tables and zero other application rows. Required owner memberships/settings/project-parent relationships are verified; no seed or repair occurs.

After READY plus receipt validation, require two distinct provider-listed staging Preview hosts. Temporarily change the existing two WorkspaceDomain hostnames from example.test to those verified hosts, without adding domains/aliases or changing ownership. Restore them after qualification. Missing second host is a hard gate, not permission to invent an alias or spoof Host.

Normal signed-session cookies are issued only for the existing passwordless fixture owners. Hosted HTTP tests require public branding isolation, authenticated homepage read isolation, anonymous403, foreign404, same-revision concurrent200+409, stale409, authoritative revision acknowledgement and unchanged other-tenant row. Chromium opens the actual hosted homepage editor at390/1440 for both tenants and rejects browser page errors or unexpected external browser requests. Cookies/raw HTML/network headers/traces are never artifacts. No storage/email/social providers are configured. Browser egress checks are not a server-side network firewall or a claim to verify every application route.

Synthetic title/revision changes from successful qualification writes remain, as in the previous tenant rehearsal. Host mappings restore; schema and ledger must match the exact preflight snapshot and fixture counts/relationships must remain valid. Unexpected data blocks and remains for review, never deleted automatically.

## Cleanup and failure handling

Once preflight passes, in-process finally restores staging exit0, restores domain bindings, removes only run-owned temporary Preview variables, and verifies schema/ledger, even when qualification fails. An independent `always()` Actions step restores suppression again if the local admission journal exists. A rejected preflight creates no journal and performs no cleanup mutation. No production request is part of cleanup.

A force-killed runner or provider outage can defeat best-effort cleanup. Such a run is NOT qualified: inspect the safe artifact and staging ignore setting before any retry. Never rerun an uncertain deployment automatically. Owner recovery restores staging exit0 first, then reviews the recorded run-owned variable marker and synthetic hostname mappings. Existing project variables are never deleted. Repeated explicit deployment attempts require review.

## Verification

Executable tests cover the real orchestration and REST transport: every lifecycle failure, wrong repository/ref/executor/candidate/confirmation, production/foreign target, unknown environment inventory, schema drift, uncertain POST, cleanup attempts after partial failure and secret-free diagnostics. Existing native build and synthetic browser regression workflows remain required. Isolated CI is distinct from live hosted evidence. Final exact executor head and CI IDs are recorded on PR323 and the canonical run claim after validation.

Stop before registration/dispatch approval. Packet16 live hosted qualification remains OPEN. No merge, production change or Packet17.

## Preflight diagnostic correction (September 21, 2026)

Reviewed executor baseline: `51f6ad1a4bde4cc54620e32214eb7f95b6f694a5`. Run35563010507 passed76 targeted tests but retained only `IDENTITY_OR_CONTRACT_MISMATCH`, empty admitted phases and `success:false`. Artifact10621934940 archive SHA256: `b422d9d0ee43c50e96db32c40d216a2d0c3cf0f3098a82c61a68f400bda28b4f`. Its original assertion is not recoverable from that evidence; no cause is inferred. No deployment identity, hosted browser result or restoration action exists for this rejected preflight.

The corrected executor labels the existing assertions and metadata-read stages without changing their predicates, argument evaluation, ordering or thrown error identity. `scripts/staging/actions/check-codes.mjs` is the fixed allowlist. Examples: `CHECK_EXECUTOR_SHA`, `CHECK_CANDIDATE_SHA`, `CHECK_GITHUB_RUN_SHA`, `CHECK_VERCEL_TEAM_ID`, `CHECK_VERCEL_PROJECT_ID`, `CHECK_DEPLOYMENT_TARGET`, `CHECK_DEPLOYMENT_SOURCE_SHA`, `CHECK_NEON_BRANCH_ID`, `CHECK_DATABASE_NAME`, `CHECK_ENVIRONMENT_ADMIN_BYPASS`, `CHECK_STAGING_SUPPRESSION`. Nested read failures retain context, for example `CHECK_GITHUB_ENVIRONMENT_READ__SCOPED_CREDENTIAL_PRESENCE` or `CHECK_NEON_PROJECT_READ__AUTHENTICATED_METADATA_STATUS`. Missing/malformed direct connection configuration is `CHECK_DATABASE_URL_PARSE`; credential presence inside a parsed URL is separately checked.

Serialized contract: allowlisted `phase`, fixed `reason`, `matched:false`, and SHA256 `detailHash`. No raw expected/observed values, URLs, headers, error properties, response bodies or credentials are serialized. Private WeakMap labels cannot be forged by provider error properties. The same reason reaches retained evidence and the terminal executor error. Existing unlabelled execution failures retain bounded fallback reasons. Application candidate is now `64af9c6462d5fb5254ef3a40b6a80b14b63594e7`, which contains the reviewed secret-safe hosted-build diagnostics. The qualification executor pins that exact source and its exact-SHA regression run.

187 diagnostic tests cover all registered reason codes, original throw semantics, secret-sentinel redaction in retained/terminal evidence, real policy mismatches, isolated execution of the real live preflight callback, read-only database rejection, and no mutation/cleanup before admission. Executable AST fingerprints strip only diagnostic wrappers and compare all four affected gate/effect files against reviewed executor51f6ad1, proving unchanged original checks and effect ordering. The existing76 executor/admission tests remain required. Full exact-head regression, isolated PostgreSQL/build and executor-contract CI are required before this correction is considered verified; final head/run evidence is recorded on PR323 and the canonical run claim.

No manual workflow, approval policy, default-branch registration, provider setting, database, suppression condition or deployment payload is changed by this correction. No live dispatch is authorized by this diagnostics task. Next live execution requires review of the new executor SHA; it alone can identify the original environmental mismatch. Packet16 remains open; Packet17 is not started.


## Diagnostic candidate repin after first admitted hosted-build failure

Run35608276802 passed protected preflight and created one staging Preview from the prior candidate, then failed during provider build with `SCHEMA_LEDGER_REJECTED`; cleanup restored staging suppression and fixture hostnames and preserved schema/ledger hashes. Hosted HTTP/Chromium was not reached.

The next candidate is pinned to `64af9c6462d5fb5254ef3a40b6a80b14b63594e7`, whose exact-SHA regression/Chromium run is35564228593. That source already contains the reviewed granular hosted-build diagnostics (`DATABASE_SCHEMA_HASH`, `DATABASE_LEDGER_CLASSIFICATION`, `DATABASE_LEDGER_TRACK` and bounded phase/reason/hash reporting). Executor policy and workflow pins were updated only to target this candidate and its matching regression evidence. No migration, database change, Vercel setting change, provider credential change, production path or qualification predicate was modified by this repin. Live dispatch remains separately gated.
