# Individual event invitation resend

In Event Invitations, expand Guest responses and choose **Resend invite** on one guest. The inline confirmation identifies the event and exact stored email, explains that only that guest receives it, and states that RSVP and extra-guest counts are unchanged. Nothing is queued until **Confirm resend** is clicked.

The request queues one separate delivery for the existing invitation. It does not run the campaign/group sender or trigger the cron worker from the browser. The next normal delivery run renders the INITIAL invitation using the existing RSVP token, existing template/copy and normal unsubscribe handling. Provider acceptance is not inbox delivery.

## Safety

- OWNER/ADMIN session and workspace-scoped event/invitation checks.
- Recipient email must still match the address shown at confirmation.
- Original invitation must have a confirmed SENT record. Pending or uncertain originals cannot create a duplicate.
- Existing marketing subscription, valid-address, bounced-group and global-suppression checks run at queue and dispatch time.
- Closed, expired or paused events cannot queue or dispatch resends.
- Stable request UUID survives a lost browser response; replay never reactivates cancelled work.
- Event-row transaction lock serializes concurrent tabs. Pending/uncertain resends block another resend; ten-minute cooldown applies after queue/acceptance.
- Each immutable RESEND stage encodes one invitation ID and request UUID. Worker scope and final checks enforce that target, and malformed stages fail closed.
- Normal provider idempotency keys, frozen payloads, claim leases and uncertainty ceiling apply.
- No invitation/RSVP rows or original delivery schedules are modified. No schema migration.

## Verification

Unit/component/service/processor tests use synthetic data and a mocked provider. They never send real invitations. Live deployment requires separate approval.
