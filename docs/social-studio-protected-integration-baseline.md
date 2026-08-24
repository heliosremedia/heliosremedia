# Protected Social Connection and Publishing Baseline

This records the known-good V1.9.9 Facebook and Instagram path before Social Studio Autopilot. The connection layer is protected and is not part of the autopilot implementation.

## Production baseline

- Version: V1.9.9
- Production commit: `3a05ed8dd3e780cb3e6aea59cf7f53ab396e2de8`
- Production deployment: `3Q4zpZKpNKeWLkXykqnaRefbxZDe`
- Facebook and Instagram: connected, tested, and direct publishing enabled

## Connection flow

1. `POST /api/admin/social/oauth/meta/connect` creates a short-lived, hashed, single-use `SocialOAuthSession`, scoped to the administrator and workspace.
2. Meta returns to `/api/admin/social/oauth/meta/callback`.
3. `lib/social/meta.ts` discovers manageable Pages and linked Instagram professional accounts without returning Page tokens to the browser.
4. Destination selection stores the existing destination IDs in `SocialConnection` and encrypts credentials server-side through `lib/social/security.ts`.
5. `/api/admin/social/connections/test` performs a read-only health check and updates connection-health metadata.

## Publishing flow

1. A post is represented by `SocialCampaign` plus platform-specific `SocialVariant` records.
2. Approval through `app/api/admin/social/campaigns/[campaignId]/route.ts` sets the exact variant revision to `APPROVED` and creates a `SocialApprovalEvent`.
3. Scheduling or confirmed send-now calls `createPublishingJob` in `lib/social/publishing.ts`.
4. That function requires an approved/scheduled variant, the workspace's exact destination, a connected and publishing-enabled `SocialConnection`, an unexpired encrypted credential, and the platform rollout flag.
5. It writes an immutable `SocialPublishingSnapshot` and idempotent `SocialPublishingJob`.
6. The Social Studio cron processes jobs through the existing provider adapters and records attempts/publications.

Autopilot drafts must use this same campaign, variant, approval, snapshot, and queue path. They must not call Meta directly.

## Protected records and code

Protected records: `SocialConnection`, `SocialOAuthSession`, `SocialConnectionAudit`, `SocialPublishingSnapshot`, `SocialPublishingJob`, `SocialPublishingAttempt`, and `SocialPublication`.

Protected code: `app/api/admin/social/oauth/[provider]/**`, `app/api/admin/social/connections/**`, `lib/social/meta.ts`, `lib/social/oauth.ts`, `lib/social/security.ts`, `lib/social/providers.ts`, and `lib/social/publishing.ts`.

The autopilot migration is additive. It does not update, delete, recreate, or re-encrypt protected records.

## Protected environment variables

`META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `SOCIAL_TOKEN_ENCRYPTION_KEY`, optional `SOCIAL_OAUTH_BASE_URL`, `SOCIAL_META_CONNECTIONS_ENABLED`, `SOCIAL_FACEBOOK_PUBLISHING_ENABLED`, `SOCIAL_INSTAGRAM_PUBLISHING_ENABLED`, and `CRON_SECRET`.

## Rollback

Set `SOCIAL_AI_AUTOPILOT_ENABLED=false` and `SOCIAL_AI_APPROVED_QUEUE_ENABLED=false`. Existing manual campaigns, jobs, history, destination IDs, and credentials remain intact. Additive autopilot tables may remain for audit/history.

