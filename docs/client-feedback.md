# Client Feedback

Client Feedback lives at `/admin/feedback` for Owners and Admins in the Helios workspace. It wraps the existing anonymous client-experience Google Form without changing the form, its response data, or the thank-you offer. Results open in Google Forms using the form owner's existing access. No Google OAuth, public response sheet, or response import is added.

## Workflow

1. Open the survey or its Google Forms responses from the overview.
2. Create a reminder. Choose the original invitation audience (default), all currently eligible workspace clients, selected groups, or individual clients.
3. Customize the subject, inbox preview, and message. The shared survey link and a polite already-responded note are appended on the server and cannot be removed from a scheduled reminder.
4. Save the draft. Saving is inactive and does not schedule or send anything.
5. Preview it with a sample recipient. Optionally confirm a test to the signed-in admin's email only.
6. Choose a date and explicit time zone, review the saved message/audience/count, acknowledge the anonymous-audience limitation, and confirm scheduling.
7. Add other reminders independently. Two spaced reminders are suggested, not automatically created. Pause a scheduled reminder to edit and reschedule it; cancel to retain it in history without delivery.

Delivery runs through the existing five-minute campaign cron. A schedule is a saved recipient snapshot. Eligibility is checked again at delivery, so opt-outs and other newly ineligible recipients are skipped. Selecting the original audience does not add new clients.

## Privacy and boundaries

- Anonymous respondents cannot be identified. Selected recipients may include people who already answered.
- Studio does not claim opens, clicks, or coupon redemption prove completion, and does not attach client IDs to the survey URL.
- Response counts are not imported or guessed. View Google Forms for the current total and analysis.
- The normal marketing unsubscribe applies. It is not a survey-only preference or proof of completion.
- The existing private-survey thank-you is separate from public reviews. No public Google review request or incentive is added.
- The survey is bound to the workspace that owns the original invitation. Other workspaces cannot use it accidentally.

## Storage and safeguards

The implementation reuses `EmailCampaign`, `CampaignRecipient`, and existing delivery events. `selection.feedbackSurveyId` identifies reminders; `selection.workspaceId` and creator workspace constrain access. No new schema, migrations, credentials, forms, or scheduled production records are required to deploy.

Only Owners/Admins may access the endpoints. Mutation and preview requests require same-origin JSON. Stable caller UUIDs deduplicate draft creation and test requests. Existing reminders require row versions; schedule/cancel/pause and cron claims use atomic status/version fences. Scheduling validates the saved draft and current audience count before recording recipients in the same transaction. Generic Email Studio mutation routes reject tagged reminders and direct admins to Client Feedback.

At dispatch, workspace membership, unchanged recipient address, subscription, validity, bounce status, and marketing suppression are checked again. The standard unsubscribe footer and existing provider pipeline remain. Feedback interrupted in PROCESSING for more than 15 minutes fails closed rather than automatically resending an uncertain delivery. Review delivery evidence before creating a replacement reminder. Ordinary email campaign recovery is unchanged.

## Verification

Run `node --experimental-strip-types --test lib/feedback*.test.ts`, `node scripts/verify-feedback-render.mjs`, scoped ESLint, TypeScript, and the aggregate suite. Tests use synthetic fixtures/mocks only and never send live mail or create production drafts/schedules.

A production smoke test should read the authenticated Feedback page and API, check original campaign/current eligibility, inspect Overview/Reminders and the linked form, and confirm no scheduled/test operations were created. Live sends or reminders require separately approved recipients, content, and timing.
