# Studio V2 product delivery plan

Owner-approved direction, October 8, 2026. Production ON HOLD.

## Original live recovery

Fresh GitHub clone; integration branch `codex/v2-hosted-access-owner-action` resolves to `96b92a3aec8e9c80d96e1be7b2fa48c6f5252f5f`. PR #393 is merged and its candidate tree equals the integration tree. PR #394 is open/draft at `64e3878c827ba4e84dcb391c52fedd3fc96ed2f7`; no later PR found in the live listing. Prior 1,840-test/runtime/Chromium artifact evidence is recorded in the existing checkpoint; this recovery does not claim a fresh execution of those historical checks.

## Current capability progress

Read `helios-studio-v2-recovery-checkpoint.md` for current verified SHAs and evidence. Policy, bounded newsletter scheduling safeguards, the workspace shell, Command Center and held-work review are integrated through PR #398. The next product slice exposes deliberate edition date changes through the existing module with reviewed-version protection. Whole lifecycle activation and hosted owner access remain bounded dependencies, not reasons to pause safe product implementation.

## Bounded foundation-readiness assessment

| Classification | Source-backed finding | Required action / feature boundary |
| --- | --- | --- |
| Critical defect before lifecycle worker activation | `newsletters/scheduler.ts` claims work without workspace lifecycle or reactivation cutoff; PR #394 reproduces suspended and overdue claims | Persist atomic database-clock reactivation cutoff; enforce claim and last pre-provider admission; retain uncertainty and settlement rules. Keep lifecycle rollout disabled until family coverage qualifies |
| Feature dependency | Newsletter, social, email, referral, AI and notification paths have separate execution and settlement contracts | Qualify each as its scheduling/recovery feature is integrated. A newsletter helper does not certify other callers |
| Feature dependency | Existing `AdminShell`, current-session authorization, scoped `getDashboardData`, and functional `/admin` modules provide reusable product architecture | Build a default-off V2 entry and navigation over these modules. Authorize every server page; retain V1 routes; qualify both-company data and role boundaries |
| Feature dependency | Existing dashboard uses section availability markers, persisted attention and schedule records | Reuse records for Command Center; surface unavailable sections explicitly; do not label absent data healthy or fabricate counts |
| Release dependency, not shell blocker | Hosted provider/CDN parity, final Helios compatibility, remaining writer race coverage and complete lifecycle activation remain open in phase checkpoint | Keep deployment/provider gates; qualify alongside affected features before enabling them |
| Deferrable hardening | Generalized worker rewrite, exhaustive unrelated content-family hardening, live-provider throughput tuning and commercial operations | Do not open packets without a reproduced defect or a named milestone dependency. Preserve existing controls; revisit at activation/release gate |

This is a bounded source assessment, not a security certification or whole Phase 1 closure. Known uncovered surfaces remain explicitly tracked in the phase checkpoint.

## Capability milestones

1. **Scheduling policy implemented in bounded families.** Preserve valid unchanged future commitments; hold overdue work; require review for ambiguous outcomes. Add atomic cutoff without rewriting workers. Acceptance: database rollback, suspension/admission races, cutoff equality, repeat suspension, approval drift, tenant isolation and safe settlement.
2. **Workspace-aware application entry.** Production-intended, default-off Studio entry, current workspace identity, accessible responsive navigation and links into existing functional modules. Keep original admin routes for rollback. No workspace selection based on an untrusted URL/header.
3. **Command Center.** Real persisted attention, approvals/failures, upcoming work and operational availability. Owners can navigate directly to the existing review workflow. No new outbound side effects from viewing the page.
4. **Integrated owner testing.** Synthetic two-workspace qualification and usable non-production preview with explicit readiness limits. Resolve defects encountered in core workflows; integrate one functional domain at a time. Hosted access issues do not prevent local/isolated implementation.
5. **First Light readiness.** Provisioning and parity gates, approved support and lifecycle, protected provider connections and explicit owner approval before real external onboarding/billing/production.

## Execution and evidence

Use fresh source, meaningful regression, TypeScript, scoped lint, responsive Chromium and isolated PostgreSQL/runtime evidence appropriate to each change. Preserve existing workflow gates, independent artifact checks and tested-tree merge verification. Do not merge an unqualified implementation. Failed gates trigger repair, not weakened assertions. Capture candidate SHA, evidence, limitations and next task in the recovery checkpoint. Continue independent safe product work when a qualification or external dependency is blocked.
