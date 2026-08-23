# Social Studio Meta V1 deployment guide

## OAuth configuration

- Production redirect URI: `https://www.heliosrealestatemedia.com/api/admin/social/oauth/meta/callback`
- Authorized JavaScript origin: none required; the flow is server-side.
- Required server variables: `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SOCIAL_OAUTH_BASE_URL`, `META_APP_ID`, `META_APP_SECRET`.
- Optional version pin: `META_GRAPH_API_VERSION` (defaults to `v23.0`; align it with the version selected in Meta App Dashboard).
- Rollout flags default off: `SOCIAL_META_CONNECTIONS_ENABLED`, `SOCIAL_FACEBOOK_PUBLISHING_ENABLED`, `SOCIAL_INSTAGRAM_PUBLISHING_ENABLED`.

Never place the app secret or encryption key in a `NEXT_PUBLIC_` variable. Configure secrets in Vercel Project Settings for the intended environment.

## Meta App Review checklist

1. Add Facebook Login and the Graph API products required by the reviewed Meta use case.
2. Register the exact production redirect URI above.
3. Request only `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, and `instagram_content_publish`.
4. Document that publishing targets Facebook Pages and Instagram professional accounts linked to Pages, never personal accounts.
5. Provide review recordings for connecting, destination selection, read-only testing, drafting, approval, immediate publishing, scheduling, and disconnecting.
6. Explain that AI drafts require human approval and that connection alone never publishes.
7. Keep the Meta app in development/test mode until controlled test-user QA passes.

## Controlled QA

Use a Meta test user and controlled Page/account. Do not publish automated tests to production accounts.

1. Enable connections only and discover one or multiple manageable Pages.
2. Confirm linked Instagram professional accounts appear separately and Pages without Instagram remain eligible for Facebook only.
3. Confirm omitted permissions and no-Page states produce actionable messages.
4. Select destinations, test each connection, and verify no test post appears.
5. Enable Facebook publishing; publish text and single-image tests, then schedule one post and confirm the cron creates exactly one provider post.
6. Enable Instagram publishing; test a single image, carousel, and eligible Reel. Confirm container processing completes before Helios records `PUBLISHED`.
7. Test partial success with separate Facebook and Instagram jobs.
8. Revoke Meta access, run the health check, and confirm reconnection is required without losing drafts or history.
9. Inspect browser responses and Vercel logs for secrets or raw provider payloads.
10. Verify the settings and destination controls at 320, 375, and 430 pixels, tablet, desktop, and 200% zoom.

## Rollback

1. Set all three rollout flags to `false`; this immediately prevents new connections and direct-publishing job creation.
2. Disable direct publishing on active connection records. Preserve connections, campaigns, snapshots, jobs, publications, and audit history.
3. Revert application code if needed. The additive migration may remain safely deployed; do not drop connection or OAuth-session tables during an incident.
4. Move queued jobs to manual fallback only when they have not reached `PUBLISHING` or `PROVIDER_PROCESSING`.
