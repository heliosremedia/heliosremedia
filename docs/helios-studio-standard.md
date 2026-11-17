# Helios Studio interface standard

Reconstructed from the retained implementation history after the unpublished local worktree was lost. This is a new patch, not recovery of commit d4f6dfd5. It is an implementation contract, not a claim that all routes are visually verified.

## Shared primitives

- Use AdminPageLayout/AdminPageHeader for page hierarchy, AdminCardHeading for workflow cards and AdminButton or admin-btn-* classes for actions.
- Preserve serif editorial headings, restrained orange labels/focus and neutral surfaces. No brown or orange-washed chrome or module-specific primary palettes.
- Primary actions follow shared ivory/dark appearance. Studio hover overrides require the appearance shell; public controls retain baseline behavior.
- Use AdminCardToggle for controlled workflow cards. Secondary native disclosures use AdminDisclosureSummary: circled +/- with 44px target, neutral hover and visible focus. It owns no state, contains no nested button and does not conditionally mount form bodies.
- Intentional compact/report/technical variants should be reusable, not copied module palettes.

## Semantic status

- admin-status-success and AdminButton variant=success indicate an actual successful/verified operation, using thin green border, subtle fill and readable green copy.
- AdminStatusBadge is static, not a live announcement. Neutral/success/warning/error preserve the caller's truthful domain label.
- AdminStatusMessage announces progress/success as status, failures as alert, with atomic content.
- Scheduled is not sent; provider acceptance is not inbox delivery; connection is not publishing permission. Green connection badges require recorded verification and healthy connected state; expiry/errors take precedence.
- Current/selected controls are not completion. admin-choice applies only to explicitly opted-in aria-pressed controls, using neutral fill and an orange outline.

## Appearance and protected content

Tokens follow the appearance shell's Day/Night/System color scheme. The legacy theme is a compatibility bridge, not permission to add arbitrary colors. Do not transform photographs, iframe recipient previews, historical email artwork or outbound templates.

## Reconstructed scope

1. Shared success/status tokens; Events and Feedback core actions/banners; neutral Feedback hero/notice.
2. Shared status badges in Newsletter and Social connections; neutral workspace-tab selection.
3. Native disclosure summaries in Blog SEO, Newsletter advanced image details, Email technical details, Social fallback and both Portfolio exclusions.
4. Shared static page headers in Settings, About, CTAs, Client Portals, Photo Comparison, Video Offerings and Homepage. All other content/data loading retained.
5. Newsletter operation feedback and generation network-error display; Social campaign creation feedback. Existing request endpoints/payloads unchanged.
6. Events Preview, Appearance, AI Writer and Update Composer actions; neutral preview-width/email-stage selection. Compact resend controls remain pending narrow-column review.
7. Independent-review corrections: public hover rules preserved; selected-state specificity exceeds legacy theme; standard and compact Studio icons both covered.

## Verification gates

`node scripts/verify-studio-standard.mjs` checks real component SSR, actual Newsletter action outcomes with stubbed network/state, CSS compilation, explicit color contrast and migration contracts. Existing module tests must also pass without additional baseline failures.

`node scripts/verify-studio-standard-browser.mjs` checks actual computed selection/public-vs-Studio hover states in both stylesheet orders, Day/Night/System and both icon sizes. It requires Playwright/Chromium; PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE can select an existing installation. A blocked launch is not a pass.

Maintain the 50-route ledger with source review and rendered verification separate. Before release, review populated/empty/loading/error, hover/focus/disabled/success, unsaved drafts, disclosures, dialogs, sticky controls, role-restricted navigation and long labels in desktop/mobile Day/Night/System. Preserve artwork. No production release without the required approval.
