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
2. PR #396, branch `codex/v2-command-center`, current candidate `54ac71bcf1b83bad3957cb1ceeaf02a9d66bb47c`, tree `ab975d3f88ee69e0ba98b1893e45d90468bdf7aa`. Runtime 37847157311 passed. Artifact 11580735413 independently downloaded and verified against SHA256 `9808d0947b50cf65fddd936e69a2707be6c1721dcbd334088e97aae0e81f561e`: both tenants, actual HTTP, forged selector rejection, role/revocation/suspension denial, alternating/concurrent reads and schema/access postflight. Regression 37847157328 has passed tests and TypeScript; Chromium remains in progress at preparation. Do not merge before full success and screenshot inspection.
3. Active branch `codex/v2-schedule-review` builds on #396. Command Center now embeds existing read-only newsletter job health, with cutoff-aware held-work explanations and existing edition review links. No retry/replay endpoint or provider action is added. Focused service/route/client tests, TypeScript and scoped lint passed; exact-head CI remains required. Runtime checks now verify held work is visible only in its owned workspace. Local Chromium installation failed with an invalid downloaded archive; browser evidence is required from CI.


Earlier failures resolved without weakening assertions: changed lifecycle helper required updating its pinned rollback-bundle checksum; imported worker initially used Neon in the driver, corrected with the same fixed disposable PrismaPg transport. Failed run 37845325647 logs independently confirm disposable container/network cleanup. No hosted database was involved.

## Next actions

1. Verify live integration and candidate heads; #395 is integrated and qualified.
2. Finish #396's exact-head full regression, Chromium screenshot inspection and real HTTP tenant/role/suspension checks; independently download/hash/parse runtime artifact before integration.
3. Finish the held scheduling review capability on `codex/v2-schedule-review`, qualify exact-head regression/browser/runtime evidence and integrate. Next connect safe existing edition review/reschedule flows, with required outbound-family admission safeguards alongside the feature. Do not begin unrelated hardening packets.
4. Work toward owner-testable non-production access while preserving provider, lifecycle and deployment admission gates. Do not mistake synthetic HTTP/PrismaPg proof for hosted Neon/Vercel/CDN or live-provider parity.

## Outstanding risks and limits

Vercel connector project inspection returned 404 for both known project names in the known team. Deployment settings were not modified. The live Vercel bot comment on PR #396, updated at 2026-10-08T21:29:40Z, reports both project deployments Ignored (2 Skipped Deployments). Direct settings inspection is still unresolved; resolve access through existing project records before any hosted deployment.

Whole lifecycle activation remains disabled: newsletter notifications and other email/referral/social/AI/provider paths still require their own admission/settlement qualification. General worker rewrite is not required for this slice. Hosted compatibility and full Helios/second-company parity remain release dependencies. Shell is a production-intended initial surface, not all-domain migration or complete live connection health. No production changes, provider activation, real credentials/operators/customers or billing have been performed.

Standing authorization: continue normal reversible non-production implementation, staging, tests, qualified PR merges and next milestones without routine permission. Owner-only stops remain production, destructive/irreversible actions, consequential security/architecture choices, billing, real external onboarding and material unexpected risk.
