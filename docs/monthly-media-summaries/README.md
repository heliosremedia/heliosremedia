# Monthly Media Summaries

Initial implementation with email design approved by Jake on November 7, 2026. No production migration, deployment, live client send, or credential changes have been performed.

## Included

- Email Studio entry and workspace-scoped owner/admin page at `/admin/email-studio/monthly-summaries`.
- Month generation, saved client reports, desktop/mobile preview, review holds, send history, and Jake-only tests.
- Separate HDPhotoHub v3 read adapter. Only order search, order detail, and client detail operations are reachable. Search POST is read-only.
- All order-search pages must finish, then all relevant details and client associations must validate before the month is saved in a transaction.
- API final totals converted to integer cents; no inferred tax or payment reconciliation.
- Stable site-ID grouping, order deduplication, conflict detection, escaped HTML, and no complimentary line items.
- Canceled/adjusted/allowance orders held for review. Archived and fully canceled orders are excluded; retained cancellation fees are held.
- `MonthlySummarySettings`, `MonthlyMediaSummary`, and `MonthlySummaryAttempt` with durable report uniqueness and request idempotency.
- Atomic generation/send claims, immutable accepted/uncertain reports, fixed retry payloads, confirmed-failure retry, and explicit manual resend after rollout approval.
- Existing unsubscribe, bounce, and suppression checks for live delivery. The initial policy conservatively honors marketing preferences; legal classification is not inferred from the email title.
- Authenticated cron endpoint. Proposed daily trigger at 16:00 UTC (9 AM MST / 10 AM MDT), due-date check for the third Monday–Friday business day. Failed generation can recover on a later daily trigger. Holidays count as weekdays.
- Two environment gates plus an off-by-default per-workspace switch. No live sender action is available until both gates are true.

## Configure for internal validation

Use the existing Helios Studio Vercel project. Do not paste credentials into source, issue bodies, or chat.

1. Add a dedicated `HDPH_V3_TOKEN` in the secret environment settings. The new API uses `hd-token`; do not assume the legacy `HDPH_API_KEY` is interchangeable.
2. Set `HDPH_SUMMARY_BRAND_ID` to Helios's verified numeric brand ID and `HDPH_SUMMARY_WORKSPACE_ID` to the existing workspace ID. A token's visibility may include child businesses; this integration limits results to the configured brand.
3. Validate the narrowest token permissions that allow order views, order detail with tasks/allowance, and the corresponding client accounts. Read-only scope must be verified in the account; role names alone are not proof that all writes are disabled. The reader itself exposes no modifying endpoints.
4. Keep `MONTHLY_SUMMARIES_DATA_APPROVED=false` and `MONTHLY_SUMMARIES_LIVE_ENABLED=false`.
5. Apply the migration only to an approved isolated test database first. Do not point a preview at the production database for migration testing. Existing project preview and production variables may share database credentials.
6. Confirm the business timezone, USD currency, test-order exclusions, order-date filter behavior, and discounts against real API responses. `excludedOrderIds` stores reviewed test-order IDs; no address/name heuristics are used.
7. Generate a completed month, select the intended test client, compare every included order and the aggregate against HDPhotoHub. Missing client-directory associations stop generation and request an existing directory sync, rather than creating a parallel CRM.
8. The sample HTML is explicitly fictional. No real client figures have been asserted as API-verified. Initial actual-data email tests are restricted server-side to `jake@heliosrealestatemedia.com`.

## Release review

- Obtain explicit approval of actual data, email rendering, and delivery behavior before deployment/live rollout.
- Verify authenticated API behavior, workspace isolation, real pagination, permissions, failure recovery, and an actual Jake-only Resend test in staging.
- Verify the exact original-total/discount/returned-amount semantics, account association, and exclusion policy. The client schema provides a login email but no mailbox-ownership verification flag.
- The root build script applies migrations automatically when `VERCEL_ENV=production`; production deployment must be explicitly reviewed.
- Only after approval, set both environment gates true and enable the workspace switch. Pausing the switch or either gate prevents subsequent live send claims.
- A fresh generation is required for an initial live send. Manual resends use the previously accepted snapshot, recheck current account/email eligibility, require explicit UI confirmation, and do not generate new purchase data.
- `ACCEPTED` means Resend accepted the message, not confirmed inbox delivery. Provider ID and intent are logged. New monthly attempts do not yet participate in the existing campaign-only delivery analytics.
- Timeouts, unknown network outcomes, idempotency conflicts, interrupted processes, or a database failure after provider acceptance stay held. Check Resend using the stored/logged provider ID and request key before any operator reconciliation. Do not clear a hold merely because 24 hours have elapsed.
- Explicit single-request rejections can retry the frozen payload under the same key. Intentional resends use a separate key. Test button repeats reuse a request ID until a new page session.
- Initial bounds: 2,000 orders, 20,000 pagination offset, 240-second read deadline, and at most 100 ready sends per daily invocation. Incomplete reading saves nothing. Larger batches need a reviewed resumable worker before increasing limits.

## Verification performed

- 47 focused summary and existing email-provider tests passed.
- Schema validation and Prisma client generation passed.
- Isolated PGlite/Postgres smoke checks passed: migration, default-off automation, monthly uniqueness, workspace separation, atomic send claim, unique delivery request keys, and foreign-key protection for retained history.
- TypeScript check passed with `--target es2022 --incremental false`. Default standalone tsc reports five pre-existing ES2017 regex-target errors in unrelated tests.
- Next.js optimized compilation and its TypeScript stage passed; full build could not finish page-data collection because the local checkout has no R2 configuration (`R2_ACCOUNT_ID`). No production credentials were retrieved to bypass that limitation.
- Email rendered and visually checked at desktop and 375px mobile widths. Actual Outlook/Gmail inbox rendering, authenticated admin UI, real HDPhotoHub data, and end-to-end database/provider delivery remain to be verified in staging.

Run focused tests with `npm run test:monthly`. The main `npm test` command also includes the new tests. No AI generation or extra paid service is required for monthly reports.

API reference inspected: https://api.hd.pics/Scalar/v3 and its OpenAPI schema at https://api.hd.pics/openapi/v3.json on November 6, 2026 (Denver).

## Brand alignment

The email uses Helios's existing Editorial Light palette (`#e8e2d7`, `#f5f0e7`, `#d8cfc0`), the site's charcoal (`#0f0f10`), and restrained Helios orange (`#d96b2b`). It retains the official logo and “Light. Clarity. Vision.” signature. Georgia is the email-safe serif fallback for the site's editorial typography; body text uses Arial/Helvetica for broad inbox compatibility. Green-tinted neutrals and the extra partnership slogan were removed.

A single “Book Your Next Shoot” CTA follows the signature, linking to `https://heliosrealestatemedia.com/book` so the existing booking settings and availability controls remain authoritative.

The approved standalone design preview embeds the official logo so it renders without a network request. Outgoing emails retain the HTTPS-hosted logo with explicit 180 × 47 dimensions and light fallback text to prevent header layout shifts. Design approval does not enable deployment or client delivery.

## PDF attachments

Each new test, live, or manual-resend payload includes a branded PDF generated from the same validated saved summary as the email. PDF failure prevents the send. The base64 attachment is stored with the frozen attempt payload so retries reuse identical bytes; historical attempts retain their original payload. Filenames use the reporting month. Attachments have a 5 MB application limit. The PDF embeds the official logo and Helios fonts, includes page numbers and the purchase-summary disclaimer, and paginates longer reports. Fonts/logo are explicitly traced for the admin and cron deployment routes.

The fictional sample is in `output/pdf/Helios-Monthly-Summary-Sample.pdf`. PDF content/margins were checked with 35 properties, accented names, long addresses/services, totals, and page numbering. Inbox attachment delivery still requires the approved staging test.

## Review workflow

The preview toolbar includes Download PDF for the fictional sample and each eligible saved report. Downloads use the authenticated owner/admin endpoint, enforce workspace membership and snapshot integrity, reject held/empty reports, and return private/no-store PDF responses. This lets the owner inspect the attachment before the Jake-only test.

Configuration metadata rechecked November 7, 2026: the existing Vercel project has the legacy `HDPH_API_KEY`, but no `HDPH_V3_TOKEN`, `HDPH_SUMMARY_BRAND_ID`, or `HDPH_SUMMARY_WORKSPACE_ID`. Both database variables target preview and production, so a preview deployment must not be assumed isolated. The next real-data validation requires a dedicated v3 token and isolated test database configuration. No credentials were decrypted, no database was migrated, and no deployment or send was performed.

## Existing v1 connection investigation

The user's account-specific documentation at `https://heliosrealestatemedia.hd.pics/api/v1/` exposes `/orders?uid=`, `/order?oid=`, `/site?sid=`, and `/users?name=` with `api_key` header authentication. Its schema includes API totals, tax, returned amounts, and canceled tasks. A new v3 token is therefore not yet established as necessary. The implemented reader remains v3 until v1 response semantics can be validated.

`node --env-file=.env.local scripts/verify-hdph-v1.mjs` performs narrowly scoped GET requests for the brand and the exact the selected test client account, then October candidate order details and site associations. Supply the existing `HDPH_API_KEY` through the local secret environment; never commit it. The script prints selected diagnostic fields, not credentials or full client records. October filtering is provisional because timezone semantics remain unverified. Missing documented pagination, lack of an explicit billed-client ID in the order schema, and site-owner versus purchaser identity need validation before adopting v1 for production.

The Vercel key is a sensitive environment variable and the connector does not return its value (`decrypted: false`). No authenticated v1 test has run. Syntax and missing-secret fail-closed behavior were checked locally. The existing key has not been altered.

## Authenticated v1 diagnostic

The owner-only preview now offers Run read-only check. It calls `/api/admin/monthly-summaries/connection-check`, uses the existing Vercel `HDPH_API_KEY`, requires the identified client to belong to the authenticated workspace, and only issues GET requests to the user-provided HDPhotoHub v1 host. It reads the approved the selected test client October 2026 case and reports whether the two totals match the user-entered reference total. This is a diagnostic, not approval to generate or send. It performs no database writes and does not call email providers. Requests with a mismatched Origin are rejected and all responses are private/no-store. Errors do not expose upstream bodies or account data. Four focused tests verify reference totals, missing credentials, workspace rejection, duplicate orders, and cross-brand property rejection.
