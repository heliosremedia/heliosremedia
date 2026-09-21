# Packet 16: protected Actions hosted qualification executor

Status: prepared for review, NOT registered on main and NOT executed live. This supersedes the manual Vercel UI procedure. No project settings, secrets, deployment, domains or live database changed during implementation.

## Two immutable identities

The application candidate is **dbfb19909d3fe0bb91d81a478210373340f86e86**, with successful regression run35556635812. The executor is a newer separately reviewed PR323 commit. Workflow inputs must pin both; Actions checks out the candidate separately and verifies its Git identity. The Vercel API request uses the original candidate SHA, never the executor head or latest branch tip. No application source overlay or build-command override is supplied.

Improved hosted-build phase/reason reporting is committed in the executor head. It cannot retroactively change the pinned candidate's build script. For this exact candidate, the executor supplies phase-specific preflight and safe provider-event diagnostics; its original native build guard remains unchanged. A future deployed source update needs separate candidate approval.

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
