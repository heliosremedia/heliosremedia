# Studio V2 live recovery checkpoint

Updated October 8, 2026. Production ON HOLD. Resume from GitHub, not interrupted local files.

## Verified integrated state

Integration branch: `codex/v2-hosted-access-owner-action`.
Latest verified application integration: `f48f9e6162ea7083305584152bc3ff13731a336e`, merged PR #395. Its tree is `728377c1f3e8f846e4c8dfb9111543d94ce76cac`, identical to qualified candidate `02b4252ffc5ee147cb1f73a592385bbc04119b03`. Regression 37846162990 passed 1,842 tests, TypeScript and all Chromium steps. Runtime 37846163053 passed with independently verified artifact as recorded below.

Policy integration: `ed6c71fb4a12ef4170c558c1ac48ea33787afccf`, merged PR #394 (approved reactivation policy and product direction). Its tree equals approved candidate `e32aa6d5164597da57fc3727008d664fb5e6c47f`. Regression 37844736236 passed every test, TypeScript and Chromium step. Prior application integration remains Packet 84, `96b92a3aec8e9c80d96e1be7b2fa48c6f5252f5f` / PR #393.

## Completed in this recovery

- Fresh clone and live branch/PR verification; no newer integrated application work found at recovery.
- Owner policy reconciled and merged: preserve valid unchanged future schedules; no overdue replay; uncertain outcomes require explicit review.
- Bounded readiness assessment and concurrent product milestones committed in `helios-studio-v2-product-delivery-plan.md`. Historical phase-order restrictions do not block safe product implementation. Existing qualification/deployment/tenant protections remain.
- Newsletter cutoff and claim/execution-admission candidate implemented, including additive migration and atomic audit; default-off. Four actual PostgreSQL SEND/GENERATE suspension races across two tenants passed.
- Workspace-aware shell and read-only Command Center implemented over existing modules and dashboard data; default-off explicit workspace allowlist, current OWNER/ADMIN admission. Responsive browser and real HTTP isolation qualification added.

## Active candidates and evidence

1. PR #395, branch `codex/v2-newsletter-reactivation-admission`, candidate `02b4252ffc5ee147cb1f73a592385bbc04119b03`. Runtime 37846163053 passed. Artifact 11579129010 independently downloaded with curl, SHA256 verified (`75f02270c51e8a4fb1d0cc0969be38f3f6ef1bf57a5235a4263f3ef59203f7b1`) and parsed: exact candidate, two tenant cases, four observed admission waits, future/overdue/equality checks, suspended/duplicate settlement and schema/access postflight. Regression 37846162990 passed all steps; merged and merge tree independently verified.
2. PR #396, branch `codex/v2-command-center`, current candidate `de1c85f4ad3ba75a5d55780d35d951b8d8af1da5`, tree `9aacb9c089a1512a9499da4c682998e776cdc639`. Prior candidate `54ac71bcf1b83bad3957cb1ceeaf02a9d66bb47c` passed 1,845 tests, TypeScript, all Chromium and runtime 37847157311. Runtime artifact 11580735413 independently matched SHA256 `9808d0947b50cf65fddd936e69a2707be6c1721dcbd334088e97aae0e81f561e`. Screenshot artifact 11581070661 independently matched `9b92e4b890960613f33f32d89a656ccf0983e4b34fa55499e8783d07900a47c9`. Visual inspection found global link reset overriding primary button text contrast. Corrected with a scoped important text utility and browser computed-color assertion. Exact current candidate runs 37848492261 (regression) and 37848492202 (runtime) must pass before merge.
3. PR #397, branch `codex/v2-schedule-review`, candidate `771cec6591ea58c5f716c2906cb102b4d7c8d026`, tree `6169066c328db76dc00d4c125a6aa5fd4c9c17f6`, includes #396 correction. Read-only newsletter job health is integrated in Command Center with cutoff-aware explanations and edition review links. Focused service/route/client tests, TypeScript and lint passed. Exact-head runs 37848572069 (regression) and 37848571925 (runtime) are in progress. Both-tenant held review and responsive browser checks are required. Retarget to integration only after #396 merges.
4. Active branch `codex/v2-approval-deadline-admission` builds on #397. Tracing scheduling review identified a concrete missed-approval mutation gap: a previously claimed deadline job could revoke approval after workspace suspension/reactivation. Adds the same locked scheduled-action admission before edition, approval or audit writes; four focused tests pass. The runtime fixture adds real database waits and denial without edition/audit mutations in both tenants. This closes a named scheduling feature dependency, not whole lifecycle activation. Exact-head full qualification remains required.


Earlier failures resolved without weakening assertions: changed lifecycle helper required updating its pinned rollback-bundle checksum; imported worker initially used Neon in the driver, corrected with the same fixed disposable PrismaPg transport. Failed run 37845325647 logs independently confirm disposable container/network cleanup. No hosted database was involved.

## Next actions

1. Verify live integration and candidate heads; #395 is integrated and qualified.
2. Finish #396's exact-head full regression, Chromium screenshot inspection and real HTTP tenant/role/suspension checks; independently download/hash/parse runtime artifact before integration.
3. Finish the held scheduling review capability on `codex/v2-schedule-review`, qualify exact-head regression/browser/runtime evidence and integrate. Qualify and integrate approval-deadline admission next, then connect safe existing edition review/reschedule flows with required outbound-family admission safeguards alongside the feature. Do not begin unrelated hardening packets.
4. Work toward owner-testable non-production access while preserving provider, lifecycle and deployment admission gates. Do not mistake synthetic HTTP/PrismaPg proof for hosted Neon/Vercel/CDN or live-provider parity.

## Outstanding risks and limits

Vercel connector project inspection returned 404 for both known project names in the known team. Deployment settings were not modified. The live Vercel bot comment on PR #396, updated at 2026-10-08T21:29:40Z, reports both project deployments Ignored (2 Skipped Deployments). Direct settings inspection is still unresolved; resolve access through existing project records before any hosted deployment.

Whole lifecycle activation remains disabled: newsletter notifications and other email/referral/social/AI/provider paths still require their own admission/settlement qualification. General worker rewrite is not required for this slice. Hosted compatibility and full Helios/second-company parity remain release dependencies. Shell is a production-intended initial surface, not all-domain migration or complete live connection health. No production changes, provider activation, real credentials/operators/customers or billing have been performed.

Standing authorization: continue normal reversible non-production implementation, staging, tests, qualified PR merges and next milestones without routine permission. Owner-only stops remain production, destructive/irreversible actions, consequential security/architecture choices, billing, real external onboarding and material unexpected risk.
