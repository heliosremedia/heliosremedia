# Studio route audit ledger

Reconstructed source inventory, not a visual sign-off. All 50 routes still require authenticated populated-page review in Day/Night/System and desktop/mobile. Source scans are not exhaustive workflow execution.

| Route | Source scope | Rendered verification |
| --- | --- | --- |
| `/admin/about` | Shared header adopted | Pending |
| `/admin/activity` | Source inventory / structural scan | Pending |
| `/admin/blog` | Source inventory / structural scan | Pending |
| `/admin/client-portals` | Shared header adopted | Pending |
| `/admin/clients` | Source inventory / structural scan | Pending |
| `/admin/ctas` | Shared header adopted | Pending |
| `/admin/email-studio/monthly-summaries` | Source inventory / structural scan | Pending |
| `/admin/email-studio/monthly-summaries/verify` | Source inventory / structural scan | Pending |
| `/admin/email-studio` | Source inventory / structural scan | Pending |
| `/admin/events` | Core/tool controls and selection migrated; handler tests required | Pending |
| `/admin/faqs` | Source inventory / structural scan | Pending |
| `/admin/feedback` | Source inventory / structural scan | Pending |
| `/admin/homepage` | Shared header adopted | Pending |
| `/admin/inquiries` | Source inventory / structural scan | Pending |
| `/admin/locations` | Source inventory / structural scan | Pending |
| `/admin/media` | Source inventory / structural scan | Pending |
| `/admin/newsletter-studio/editions/[editionId]` | Source inventory / structural scan | Pending |
| `/admin/newsletter-studio` | Shared badges and operation feedback migrated | Pending |
| `/admin/newsletter-studio/series/[seriesId]` | Source inventory / structural scan | Pending |
| `/admin/newsletter-studio/series/new` | Source inventory / structural scan | Pending |
| `/admin` | Source inventory / structural scan | Pending |
| `/admin/photo-comparison` | Shared header adopted | Pending |
| `/admin/portfolio-intelligence/[projectId]` | Source inventory / structural scan | Pending |
| `/admin/portfolio-intelligence` | Source inventory / structural scan | Pending |
| `/admin/projects/[projectId]` | Source inventory / structural scan | Pending |
| `/admin/projects/new` | Source inventory / structural scan | Pending |
| `/admin/projects` | Source inventory / structural scan | Pending |
| `/admin/referral-studio/campaigns/[campaignId]/edit` | Source inventory / structural scan | Pending |
| `/admin/referral-studio/campaigns/[campaignId]` | Source inventory / structural scan | Pending |
| `/admin/referral-studio/campaigns/new` | Source inventory / structural scan | Pending |
| `/admin/referral-studio` | Source inventory / structural scan | Pending |
| `/admin/referral-studio/referrals/[submissionId]` | Source inventory / structural scan | Pending |
| `/admin/referral-studio/referrals/new` | Source inventory / structural scan | Pending |
| `/admin/release-notes/[slug]` | Source inventory / structural scan | Pending |
| `/admin/release-notes` | Source inventory / structural scan | Pending |
| `/admin/services` | Source inventory / structural scan | Pending |
| `/admin/settings` | Shared header adopted | Pending |
| `/admin/social-studio/analytics` | Source inventory / structural scan | Pending |
| `/admin/social-studio/analytics/posts/[variantId]` | Source inventory / structural scan | Pending |
| `/admin/social-studio/analytics/report` | Source inventory / structural scan | Pending |
| `/admin/social-studio/calendar` | Source inventory / structural scan | Pending |
| `/admin/social-studio/campaigns/[campaignId]` | Source inventory / structural scan | Pending |
| `/admin/social-studio` | Creation feedback migrated | Pending |
| `/admin/social-studio/queue` | Source inventory / structural scan | Pending |
| `/admin/social-studio/series` | Source inventory / structural scan | Pending |
| `/admin/social-studio/settings` | Source inventory / structural scan | Pending |
| `/admin/testimonials` | Source inventory / structural scan | Pending |
| `/admin/trusted-logos` | Source inventory / structural scan | Pending |
| `/admin/users` | Source inventory / structural scan | Pending |
| `/admin/video-offerings` | Shared header adopted | Pending |

## Remaining work

- Other module-specific buttons, statuses, selections and repeated card/header/disclosure markup.
- Computed contrast of small muted text, dark/light interactions and narrow layouts.
- Real keyboard/focus/unsaved-input persistence review of native disclosures.
- Compact event resend controls and populated dialog workflows.
- Validate public consumers and protected media remain unchanged.
- Reconcile unrelated baseline failures without hiding them.

Historical pre-loss evidence: 874 tests with 864 passed and 10 failures; baseline 873 tests with 863 passed and the same 10 failures. These historical results do not validate this reconstruction. Fresh results must be recorded separately.

## Earlier reconstruction validation

On this reconstructed tree: full suite 874 tests, 864 passed, 10 failed. Independently reran exact remote appearance baseline 1b5ed1e: 873 tests, 863 passed, the identical 10 failures. Failure names match; no new suite failures. Component/handler SSR, CSS compilation, appearance validation and targeted ESLint passed.

Actual computed-style browser fixture was attempted with installed Chromium and failed to launch because the environment forbids Chromium's singleton socket. This is not a passed browser check. All populated-route visual verification remains pending.

## Release candidate verification (2026-11-17)

Rebased on production b473c7ef. Full suite: 877 tests, 867 passed and the same 10 existing failures as that baseline (873 tests, 863 passed). Targeted lint and static appearance/standard checks pass. A new implicit-any in a test was fixed; typecheck now reports only the same five existing ES2018 regex-target errors as production baseline.

Hosted Chromium QA passed at 9dd63005, including Day/Night/System, explicit overrides against opposite OS themes, both CSS orders, scoped public hover isolation and 4.5:1 computed shared action/status contrast. A final reverse-Tab dismissal fix and regression assertion require the updated hosted run before merge.

Authenticated populated desktop preview reviewed: Dashboard typography and unequal-height collapsed cards (expand/collapse restored), Newsletter tabs/badges, Feedback Overview/Reminders with sent status, Global site settings shared header, and compact appearance menu with Night reload persistence and Day selection. These are representative checks, not full route, mobile or destructive/send workflow certification. No campaigns were sent and no content records were created.
