# Studio V2 product delivery plan

Owner-approved direction, October 8, 2026. Production ON HOLD.

## Original live recovery

Fresh GitHub clone; integration branch `codex/v2-hosted-access-owner-action` resolves to `96b92a3aec8e9c80d96e1be7b2fa48c6f5252f5f`. PR #393 is merged and its candidate tree equals the integration tree. PR #394 is open/draft at `64e3878c827ba4e84dcb391c52fedd3fc96ed2f7`; no later PR found in the live listing. Prior 1,840-test/runtime/Chromium artifact evidence is recorded in the existing checkpoint; this recovery does not claim a fresh execution of those historical checks.

## Current capability progress

Read `helios-studio-v2-recovery-checkpoint.md` for current verified SHAs and evidence. Policy, bounded newsletter safeguards, workspace shell, Command Center, date changes and scoped job review are integrated through #405, including workspace Media Library discovery, reviewed project-detail editing, recoverable private draft creation and reviewed media metadata editing. #401 and #406 reconcile recovery. Current product work moves to the complete owner path through media additions, services and review. Fixes are tied to observed workflow defects: unscoped library/count reads, stale edit overwrite, uncertain-save retries, and creation authorization/form recovery. Whole lifecycle activation and hosted access remain bounded dependencies.

Next capability milestone: create a private draft, edit its details, add and organize synthetic media, then reach review/publishing controls with explicit readiness limits. Complete each workflow's tenant, revision, storage and provider checks alongside its UI. Do not measure progress by packet count.

## Bounded foundation-readiness assessment

| Classification | Source-backed finding | Required action / feature boundary |
| --- | --- | --- |
| Critical defect before lifecycle worker activation | Original assessment: `newsletters/scheduler.ts` admitted suspended/overdue work; PR #394 reproduced the defect. Newsletter SEND, GENERATE and approval-deadline guards are now integrated and qualified in #395/#398; other families remain bounded dependencies | Preserve the integrated atomic cutoff/admission and uncertainty rules. Keep whole lifecycle rollout disabled until each activated family qualifies |
| Feature dependency | Newsletter Studio HTTP admission remains single-company; its recipient/delivery/asset isolation must qualify before multi-workspace module activation. Newsletter, social, email, referral, AI and notification paths have separate execution and settlement contracts | Qualify each as its scheduling/recovery feature is integrated. A newsletter helper does not certify other callers |
| Feature dependency | Existing `AdminShell`, current-session authorization, scoped `getDashboardData`, and functional `/admin` modules provide reusable product architecture | Default-off V2 entry/navigation are integrated and qualified. Retain fresh authorization, V1 rollback routes and both-company module checks as workflows are added |
| Feature dependency | Existing dashboard uses section availability markers, persisted attention and schedule records | Command Center is integrated over persisted records with explicit unavailable states. Continue source-backed status as each module joins |
| Feature dependency | Reviewed per-asset metadata editing is integrated with conflict/uncertainty recovery; media additions, bulk organization, services and publishing retain separate existing contracts | Qualify the complete private-draft owner path with synthetic records and existing storage/provider containment; resolve demonstrated integration defects without rewriting working modules |
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
