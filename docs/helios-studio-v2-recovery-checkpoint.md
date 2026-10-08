# Studio V2 live recovery checkpoint

Updated October 8, 2026. Production ON HOLD. Resume from GitHub, not interrupted local files.

## Verified integrated state

Integration branch: `codex/v2-hosted-access-owner-action`.
Latest verified integration: `ed6c71fb4a12ef4170c558c1ac48ea33787afccf`, merged PR #394 (approved reactivation policy and product direction). Its tree equals approved candidate `e32aa6d5164597da57fc3727008d664fb5e6c47f`. Regression 37844736236 passed every test, TypeScript and Chromium step. Prior application integration remains Packet 84, `96b92a3aec8e9c80d96e1be7b2fa48c6f5252f5f` / PR #393.

## Completed in this recovery

- Fresh clone and live branch/PR verification; no newer integrated application work found at recovery.
- Owner policy reconciled and merged: preserve valid unchanged future schedules; no overdue replay; uncertain outcomes require explicit review.
- Bounded readiness assessment and concurrent product milestones committed in `helios-studio-v2-product-delivery-plan.md`. Historical phase-order restrictions do not block safe product implementation. Existing qualification/deployment/tenant protections remain.
- Newsletter cutoff and claim/execution-admission candidate implemented, including additive migration and atomic audit; default-off. Four actual PostgreSQL SEND/GENERATE suspension races across two tenants passed.
- Workspace-aware shell and read-only Command Center implemented over existing modules and dashboard data; default-off explicit workspace allowlist, current OWNER/ADMIN admission. Responsive browser and real HTTP isolation qualification added.

## Active candidates and evidence

1. PR #395, branch `codex/v2-newsletter-reactivation-admission`, candidate `02b4252ffc5ee147cb1f73a592385bbc04119b03`. Runtime 37846163053 passed. Artifact 11579129010 independently downloaded with curl, SHA256 verified (`75f02270c51e8a4fb1d0cc0969be38f3f6ef1bf57a5235a4263f3ef59203f7b1`) and parsed: exact candidate, two tenant cases, four observed admission waits, future/overdue/equality checks, suspended/duplicate settlement and schema/access postflight. Regression 37846162990 pending at this checkpoint; do not merge before all steps pass.
2. PR #396, branch `codex/v2-command-center`, initial candidate `c3401c6d4d24a4869d379a784a52c78a0245d4e4`. Runtime 37846657673 and regression 37846657653 in progress at preparation. New documentation/screenshot-artifact commit requires fresh exact-head runs. Ten focused access/branding/navigation tests, TypeScript and scoped lint passed locally. Local Chromium installation failed with an invalid downloaded archive, so no local browser pass is claimed.

Earlier failures resolved without weakening assertions: changed lifecycle helper required updating its pinned rollback-bundle checksum; imported worker initially used Neon in the driver, corrected with the same fixed disposable PrismaPg transport. Failed run 37845325647 logs independently confirm disposable container/network cleanup. No hosted database was involved.

## Next actions

1. Verify live candidate heads and CI; finish #395's regression/Chromium checks, confirm its merge tree, then integrate to the non-production branch.
2. Finish #396's exact-head full regression, Chromium screenshot inspection and real HTTP tenant/role/suspension checks; independently download/hash/parse runtime artifact before integration.
3. Continue usable product capability: expose held scheduling work clearly in the Command Center and integrate existing review/reschedule workflows. Qualify the affected remaining outbound family alongside that feature. Do not begin unrelated hardening packets.
4. Work toward owner-testable non-production access while preserving provider, lifecycle and deployment admission gates. Do not mistake synthetic HTTP/PrismaPg proof for hosted Neon/Vercel/CDN or live-provider parity.

## Outstanding risks and limits

Whole lifecycle activation remains disabled: newsletter notifications and other email/referral/social/AI/provider paths still require their own admission/settlement qualification. General worker rewrite is not required for this slice. Hosted compatibility and full Helios/second-company parity remain release dependencies. Shell is a production-intended initial surface, not all-domain migration or complete live connection health. No production changes, provider activation, real credentials/operators/customers or billing have been performed.

Standing authorization: continue normal reversible non-production implementation, staging, tests, qualified PR merges and next milestones without routine permission. Owner-only stops remain production, destructive/irreversible actions, consequential security/architecture choices, billing, real external onboarding and material unexpected risk.
