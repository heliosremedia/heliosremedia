# Monthly summary delivery and compact settings

Status: implemented in this branch; production rollout and end-to-end delivery verification pending. Requested by Jake on November 7, 2026. Jake subsequently authorized October as the first delivery month with held reports excluded, followed by ongoing automation. No delivery is claimed until confirmed by provider history.

## Manual delivery

From a saved reporting month, search for a client and select their saved report. Provide Send to client for an eligible unsent summary and Resend summary for an already accepted summary. Include the matching PDF. Confirm the recipient and reporting month before sending. Keep Send test to Jake separate. Record recipient, timestamp, send type, provider acceptance and failures in history; provider acceptance must not be described as inbox delivery.

Manual delivery and resend must work when automation is paused, while retaining live delivery approval, workspace authorization, snapshot validation, recipient checks, unsubscribe/bounce suppression, generation locks, and holds for invalid or uncertain reports. Preserve saved historical content rather than silently regenerating it. Duplicate clicks/retries must not create duplicate deliveries; manual first sends and scheduled sends must coordinate claims and idempotency. Confirmed failures can be retried; uncertain attempts require reconciliation. A successful resend must allow a later deliberate resend with a new request identifier.

## Compact delivery settings

Make Delivery settings collapsible and default it to collapsed. Keep a compact header with delivery/automation status and a keyboard-accessible expand/collapse control. Preserve all sender, connection and internal test information inside the expanded section. Place Verify existing HDPhotoHub connection immediately to the right of Enable/Pause automation within the settings controls; retain owner-only visibility and allow controls to wrap on mobile. Remove the separate verification row beneath the settings card so monthly totals, month selection, search, and reports appear higher on the page. Label automation status separately from manual client delivery availability.

## Automation findings and activation

Current implementation requires MONTHLY_SUMMARIES_LIVE_ENABLED=true and MONTHLY_SUMMARIES_DATA_APPROVED=true, a configured V3 connection and matching HDPH_SUMMARY_WORKSPACE_ID, plus the saved automationEnabled preference. Verify production configuration without exposing secrets. Do not turn flags on as part of this specification.

Fix liveDeliveryApproved: it currently rejects any environment containing HDPH_API_KEY, although reader selection correctly prefers HDPH_V3_TOKEN. Use the shared reader policy and retain explicit approval gates; do not remove a legacy key potentially used by other features.

Current cron checks daily at 16:00 UTC. It targets the previous calendar month after the third weekday of the following month at 09:00 America/Denver. Weekdays do not exclude holidays. The fixed UTC cadence differs from 09:00 Denver during daylight saving time, so display the actual effective schedule or align it before promising an exact local delivery time.

Enabling during November can generate and send eligible October summaries on the next cron run because October is already due. The activation flow must explain this catch-up behavior and confirm the intended first reporting month before activation. Keep held reports held. Verify cron authentication, workspace binding and production deployment before enabling. Do not create a separate ChatGPT automation for this application job.

## Verification criteria

- Manual first send and resend succeed with automation off and delivery approved; cron remains paused.
- Missing delivery approval, legacy review snapshots, workspace mismatch, bad snapshots, suppression and uncertain delivery still block sending.
- Manual and scheduled sends cannot deliver the same initial summary twice; repeated intentional resends remain possible.
- PDF and saved snapshot agree and dated send history survives reload/month switching.
- V3 works with a legacy key also present; legacy-only mode cannot enable live sending.
- Settings collapse/expand works with keyboard and mobile layout; verification action retains role restrictions.
- Confirm first-month behavior and daily cron timing before activation. Test with mocked delivery or Jake's internal test inbox, not real clients without explicit send instructions.

## Month delivery controls

Send month targets READY reports without an accepted timestamp, regardless of search filters. Resend month appears only after at least one report has an accepted timestamp and targets currently ACCEPTED reports. Both confirm the month and recipient count, send sequentially, stop on an error, and refresh persisted statuses. Keep the tab open while sending; a stopped batch requires reviewing history before another batch. Per-client send/resend remains available.

## Validation

56 monthly-summary tests pass, including manual delivery while automation is off, generation holds, V3 plus legacy-key coexistence and shared initial-send idempotency. TypeScript with ES2018 target passes; the repository's default typecheck has existing regex-target failures in unrelated test files. Browser and real delivery verification remain pending.
