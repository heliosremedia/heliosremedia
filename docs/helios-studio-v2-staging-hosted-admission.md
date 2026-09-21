# Packet 16: staging-only hosted build admission

Implementation only. Both Vercel projects remain suppressed with `exit 0`. No deployment, environment configuration, host binding, live database write or migration is authorized by this implementation checkpoint. PR #323 remains draft/unmerged.

## Verified baseline

Tenant baseline candidate `6e9544067b73909dcd68e2859c9345976172918f`, protected run35553978752 attempt1 passed:1001/1001 tests; real Neon route/service tests with signed synthetic request contexts; two tenant directions; foreign404; concurrent200+409; stale409; unchanged schema/ledger. Independent postflight found two rows in each of seven fixture tables and all other106 application tables empty.19 migrations complete. This is not hosted HTTP evidence.

## Admission implementation

`npm run build` remains the supported entry. Only explicit `STAGING_HOSTED_ADMISSION=preview-only` enters the new executor; all other hosted contexts retain the existing rejection. The executor validates before external reads:

- Vercel project `prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg`, team `team_H79eaUfq9xMqcbf34ZCtwwn9`, `VERCEL_ENV=preview` and VERCEL=1.
- Branch `codex/v2-neon-staging-bootstrap`, exact owner-pinned STAGING_CANDIDATE_SHA equals Vercel source SHA and Git checkout HEAD.
- Dedicated random48-byte AUTH_SECRET (96 lowercase hex characters); tenant context enabled. No local workspace override or provider configuration families.
- DATABASE_URL and DIRECT_URL both address the verified direct staging endpoint/database with TLS. No alternate targets, pooler, unapproved URL parameters, environment files or dirty tracked source.

Authenticated fixed-origin Vercel GETs establish project/team/repository linkage, in-progress deployment ID/URL, Preview target, exact source SHA/ref and domain inventory. Unexpected API shape, pagination, absent metadata or production/custom domain fails closed. GitHub GETs require successful exact-SHA push regression workflow and test job. Neon GETs require the already established project/org/branch/endpoint/database policy.

Read-only PostgreSQL preflight requires the pinned complete schema fingerprint, valid complete baseline migration ledger and immutable repository migration/schema manifest. A cooperating-release advisory lock spans the build. Generated Prisma7.8 client equivalence is checked. Only Prisma generate and Next build execute; no migration/resolve/push/deploy command. Postflight compares schema and full ledger hashes. No automatic retry or repair.

Next receives a restricted child environment without provider/admission API credentials. External provider credentials must also be absent from Vercel Preview configuration. CRON_SECRET is forbidden; existing cron authorization fails closed. No real provider connections are seeded. This is not a general network egress firewall; hosted request/network observation remains a later qualification gate.

The version1 `staging-evidence/hosted-build.json` and allowlisted STAGING_BUILD_RECEIPT log line bind source SHA, authenticated project/deployment identity, GitHub run/attempt, migration/schema/lockfile identity, schema/ledger hashes and `.next` tree digest excluding cache. A canonical checksum protects integrity. It explicitly records hostedQualification=false and promotable=false. This is a native Next build receipt, not a claim that Vercel's subsequently packaged uploaded functions have independently attested identical bytes. Provider build-log/receipt correlation and actual hosted HTTP verification remain required.

## Synthetic authentication and hostname preparation

`scripts/staging/hosted-session.ts` is runner-only, not an application endpoint. It accepts only the two stored synthetic owners with active same-workspace OWNER membership and no password. It uses existing createSessionToken/verifySessionToken and returns secure HttpOnly host-scoped cookies in memory. Normal deployed getAdminSession still performs database membership/sessionVersion validation. Never log tokens or put them in artifacts. Existing session lifetime is12hours; rotate the staging-only AUTH_SECRET after qualification to invalidate them. Browser checks must use separate contexts.

`hostnameBindings` prepares two distinct active PUBLIC_SITE mappings only when both hostnames are listed on an authenticated READY Preview deployment owned by staging. Only prefixed staging vercel.app hostnames pass; the default production-target alias, custom/foreign domains, duplicate hosts and arbitrary Host overrides are rejected. No bindings are written by this packet. A separately reviewed fixture update will bind the two hosts after deployment provenance is established. Retain existing example.test mappings; updating the fixture footprint requires explicit review of the tenant executor's exact-count guard.

## Staging configuration names (no values/secrets in evidence)

Runtime: DATABASE_URL, DIRECT_URL, AUTH_SECRET, STUDIO_V2_TENANT_CONTEXT_ENABLED.
Admission: STAGING_HOSTED_ADMISSION, STAGING_CANDIDATE_SHA, STAGING_RELEASE_RUN_ID, STAGING_VERCEL_READ_TOKEN, STAGING_GITHUB_READ_TOKEN, STAGING_NEON_API_KEY.
Provider supplied: VERCEL, VERCEL_ENV, VERCEL_PROJECT_ID, VERCEL_ORG_ID, VERCEL_DEPLOYMENT_ID, VERCEL_URL, VERCEL_GIT_COMMIT_REF, VERCEL_GIT_COMMIT_SHA.

Use Preview branch-specific values only. Admission credentials must be scoped read-only where providers permit; don't reuse production credentials. Their secure installation and provider response-shape verification remain external gates. No secrets have been configured by this work.

## One-shot procedure, owner approval required before execution

1. Review final exact candidate and successful CI. Recheck staging identity/domain/env-name inventory and current Neon state. Preserve production exit0.
2. Securely configure only staging Preview runtime/admission variables, including the reviewed SHA and successful exact-head regression run ID. Verify system identity variables are exposed. No build-command override; use npm run build.
3. After explicit owner approval, replace ONLY staging Ignored Build Step with this expression, substituting the literal reviewed SHA (never an automatically moving branch head):

```sh
if [ "$VERCEL_PROJECT_ID" = "prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg" ] && [ "$VERCEL_ENV" = "preview" ] && [ "$VERCEL_GIT_COMMIT_REF" = "codex/v2-neon-staging-bootstrap" ] && [ "$VERCEL_GIT_COMMIT_SHA" = "REVIEWED_SHA" ]; then exit 1; else exit 0; fi
```

4. Explicitly create one Preview deployment from that exact Git SHA in helios-v2-staging. Do not push a trigger commit, use main, promote, or select production. Confirm Preview classification before submission. The ignore condition is a coarse trigger filter, not admission evidence. If provider UI cannot select the exact source/Preview target, stop for a reviewed API procedure rather than improvise.
5. Collect authenticated deployment/build identity and receipt. Missing fields or rejected preflight blocks; do not bypass the build script. Restore staging exit0 after the attempt; retain production exit0 throughout.
6. Only after admission/provenance succeeds, perform separately reviewed hostname bindings, normal signed-session hosted HTTP and Chromium390/1440 checks and unchanged-schema/ledger postflight. No rollback/promotion is authorized by this implementation turn.

## Verification and limitations

Targeted executable tests cover coordinator ordering, negative environment/provider identity, stale CI, provider credentials, failed builds/postflight drift, deterministic receipt, actual production build CLI rejection, hostname plans and real token signature verification. Existing production-block tests remain intact. Isolated CI exercises the actual coordinator and PostgreSQL16 pre/postflight around a Next build using synthetic provider metadata. Final exact-head totals and run IDs are recorded on the PR and canonical run claim, avoiding a self-referential source-SHA update.

No hosted build/deployment or real provider-provenance success is claimed until the live execution occurs. No change to #320 synthetic admission contract, existing isolation flags, migrations, public rendering or OAuth. Rollback of code restores unconditional hosted rejection; keep builds suppressed during any rollback. Full Packet16 remains open. Recommended next work within Packet16 only: secure staging configuration/provenance and explicitly approved one-shot Preview qualification.
