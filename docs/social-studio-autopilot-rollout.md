# Social Studio Autopilot Staged Rollout

The autopilot is additive and is intentionally separated from the working Meta connection layer.

## Phase 1: database and review-only drafts

1. Apply `20260824010000_social_autopilot_foundation`.
2. Keep `SOCIAL_AI_AUTOPILOT_ENABLED=false` during migration verification.
3. Confirm existing Facebook and Instagram `SocialConnection` records, provider destination IDs, connection-health timestamps, scheduled variants, publishing jobs, and publication history are unchanged.
4. Enable `SOCIAL_AI_AUTOPILOT_ENABLED=true` only in a non-production environment.
5. Generate a test week and confirm every generated variant begins in `NEEDS_REVIEW`.
6. Keep `SOCIAL_AI_APPROVED_QUEUE_ENABLED=false`.

## Phase 2: notification and approval validation

1. Configure `SOCIAL_WEEKLY_EMAIL_ENABLED=true` and `SOCIAL_REVIEW_EMAIL_FROM` in the controlled environment.
2. Confirm the email links to the authenticated Social Studio review screen and contains no approval action.
3. Confirm email failure leaves all drafts intact.
4. Exercise the existing campaign editor approval, revision, media-change, and rejection paths.
5. Confirm material edits clear the existing variant approval fields.

## Phase 3: existing queue bridge

1. Enable `SOCIAL_AI_APPROVED_QUEUE_ENABLED=true` only after approval regression checks pass.
2. Confirm unapproved, changed, or rejected variants are refused.
3. Confirm approved variants create jobs through `createPublishingJob` using the already-connected workspace destination.
4. Use controlled non-production Facebook and Instagram destinations for publishing tests.
5. Confirm idempotency and partial-platform failure behavior through the existing publishing worker.

## Rollback

Set both flags to `false`:

```text
SOCIAL_AI_AUTOPILOT_ENABLED=false
SOCIAL_AI_APPROVED_QUEUE_ENABLED=false
```

This disables generation and the AI-to-queue bridge without changing or disconnecting any Facebook or Instagram destination. The additive tables can remain for history and audit purposes.

## Explicitly deferred

AI image generation, controlled external research, automated reminders, recurring cron generation, conversational revisions, approve-all, and analytics-informed recommendations remain separate later stages. None are represented as production-ready by this foundation.
