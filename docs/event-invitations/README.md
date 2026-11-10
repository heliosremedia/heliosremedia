# Event Invitations

A focused addition to the current Studio, independent of Studio V2.

## Workflow

Open Email Studio → Event Invitations. Create a draft with title, description, venue, future start date/time, timezone, optional end time, optional HTTPS venue website and an all/group/individual client audience. Preview each email and optionally send a test to an explicitly chosen address. Test previews show disabled RSVP choices and cannot submit an RSVP. Live choices open the private RSVP page with a response preselected; guests must explicitly submit to record it.

The initial schedule confirmation also schedules a follow-up 14 days later for nonresponders and Maybe replies, and a reminder 24 hours before the event for Yes responses. If those dates would conflict, the preview explains which stages are omitted. Explicitly scheduling a later stage changes only that stage and cannot precede initial delivery. Recipients are frozen when the initial invitation is scheduled, then preferences, workspace membership, address validity and RSVP response are checked again before delivery.

Attendance is one Yes/No/Maybe response per invited client. Maybe replies remain eligible for follow-up; only Yes replies receive the day-before reminder. No plus-one or capacity rules are assumed. Guests can change their response until the event starts. Cancelling stops pending sends and closes RSVP links; it does not automatically email guests or recall accepted messages. Event details are immutable after initial scheduling in this first release.

## Email wording

Each draft has separate subject and message fields for Initial invitation, Follow-up and Day-before reminder. Leaving a field blank uses its stage-specific default. Preview each stage before scheduling. Custom messages are plain text; date, location, optional venue link, RSVP choices and unsubscribe information remain included automatically. Copy is locked after scheduling and does not rewrite frozen retry payloads.

## Event appearance

Drafts support Classic, Christmas, New Year, Thanksgiving, Halloween, Easter, Summer and Celebration themes. Theme colors carry through email previews, delivered invitations and the private RSVP screen. Existing events keep the Classic theme.

Choose an optional image from the event media picker or upload a JPG/PNG, add a useful image description, and preview before scheduling. Only approved first-party media URLs are accepted; arbitrary external image hosts are rejected. Removing artwork leaves the selected theme in place. Images are optional, and all essential details and RSVP actions remain text. Appearance, like other event details, is locked after scheduling; frozen delivery payloads are not rewritten.

## Safety and deployment

- Apply the additive `20261110120000_event_invitation_themes` migration for appearance fields. It adds a Classic default and nullable image metadata; it does not edit schedules or recipient records.
- Apply the additive `20261109000000_event_invitations` migration before serving the new application. The existing production build runs `prisma migrate deploy`.
- Uses existing `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, Resend sender settings and `CRON_SECRET`. `AUTH_SECRET` must be stable and at least 32 characters; rotating it makes existing encrypted invitation links/payloads unreadable.
- `/api/cron/events` is authenticated and registered in `vercel.json`. Scheduling is explicit and new tables contain no schedules or recipients by default. Deployment alone sends nothing.
- RSVP uses random 256-bit tokens, hashes for lookup and encrypted tokens/payloads at rest. The email link carries its token in a fragment, not a query string. The public page removes it from the address bar, excludes analytics, has noindex/no-referrer metadata and uses no-store API responses. Refreshing the cleaned page requires reopening the original email link.
- GET requests never change RSVP status. Only explicit Yes/No POST submissions do.
- The outbox uses per-message claims, frozen payloads and stable provider idempotency keys. Uncertain sends are held after bounded retry/retention limits; they are not automatically resent indefinitely.
- Resend webhook handling associates event provider IDs and honors permanent bounce/complaint suppression. Early unmatched provider IDs request redelivery rather than being permanently discarded.
- Delivery is queued on a five-minute cron, not a promise that every recipient receives mail at the exact scheduled minute. Inspect failed/uncertain records before any manual operational retry.

## Verification

Run `npm test`, `node --experimental-strip-types --test app/admin/events/ui-helpers.test.ts`, scoped ESLint, Prisma validation, TypeScript and production build. Existing repository-wide tests contain unrelated baseline failures; record exact results for the release. A live staging smoke test should cover create/edit draft, preview, disabled RSVP test link, explicit scheduling, Yes→No updates, response-aware reminders, cancellation and provider webhooks using only approved test recipients. Do not create or send a real event as a deployment test.
