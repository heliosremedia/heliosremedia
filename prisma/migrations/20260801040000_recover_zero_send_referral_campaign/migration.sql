-- Recover the exact July 28 9:36 PM America/Denver referral schedule after
-- the sender-domain repair was validated by a successful one-recipient test.
-- This migration refuses to act if any invitation has sent/provider evidence.

INSERT INTO "ReferralAuditEvent" (
  "id", "campaignId", "actorId", "action", "summary", "metadata", "createdAt"
)
SELECT
  'v18910recover' || substr(md5(c."id"), 1, 14),
  c."id",
  NULL,
  'ZERO_SEND_CAMPAIGN_RECOVERED',
  'Recovered all zero-send referral invitations after the sender-domain repair was validated.',
  jsonb_build_object(
    'scheduledAt', c."deliveryScheduledAt",
    'preparedAdvocates', 149,
    'historicalProviderFailures', 50,
    'recoveredInvitationCommunications', 149,
    'release', 'V1.8.9.10'
  ),
  CURRENT_TIMESTAMP
FROM "ReferralCampaign" c
WHERE c."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND c."preparedAdvocateCount" = 149
  AND c."scheduledAudienceCount" = 149
  AND c."deliveryScheduledAt" >= TIMESTAMPTZ '2026-07-29 03:36:00+00'
  AND c."deliveryScheduledAt" < TIMESTAMPTZ '2026-07-29 03:37:00+00'
  AND c."scheduleConfirmedAt" IS NOT NULL
  AND c."executionAuthorizedAt" IS NOT NULL
  AND c."scheduledRevisionId" = c."approvedRevisionId"
  AND (SELECT count(*) FROM "ReferralCommunication" all_invites
       WHERE all_invites."campaignId" = c."id"
         AND all_invites."kind" = 'INVITATION') = 149
  AND (SELECT count(*) FROM "ReferralCommunication" failed
       WHERE failed."campaignId" = c."id"
         AND failed."kind" = 'INVITATION'
         AND failed."status" = 'FAILED') = 50
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = c."id"
      AND sent."kind" = 'INVITATION'
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  )
ON CONFLICT ("id") DO NOTHING;

UPDATE "ReferralCommunication" communication
SET
  "status" = 'SCHEDULED',
  "scheduledAt" = campaign."deliveryScheduledAt",
  "failureCode" = NULL,
  "failureMessage" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ReferralCampaign" campaign
WHERE communication."campaignId" = campaign."id"
  AND communication."kind" = 'INVITATION'
  AND communication."sentAt" IS NULL
  AND communication."providerMessageId" IS NULL
  AND campaign."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."scheduledAudienceCount" = 149
  AND campaign."deliveryScheduledAt" >= TIMESTAMPTZ '2026-07-29 03:36:00+00'
  AND campaign."deliveryScheduledAt" < TIMESTAMPTZ '2026-07-29 03:37:00+00'
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND campaign."scheduledRevisionId" = campaign."approvedRevisionId"
  AND (SELECT count(*) FROM "ReferralCommunication" all_invites
       WHERE all_invites."campaignId" = campaign."id"
         AND all_invites."kind" = 'INVITATION') = 149
  AND (SELECT count(*) FROM "ReferralCommunication" failed
       WHERE failed."campaignId" = campaign."id"
         AND failed."kind" = 'INVITATION'
         AND failed."status" = 'FAILED') = 50
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = campaign."id"
      AND sent."kind" = 'INVITATION'
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  );

UPDATE "ReferralInvitation" invitation
SET
  "status" = 'SCHEDULED',
  "scheduledAt" = campaign."deliveryScheduledAt",
  "failureCode" = NULL,
  "failureMessage" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ReferralCampaign" campaign
WHERE invitation."campaignId" = campaign."id"
  AND invitation."sentAt" IS NULL
  AND invitation."providerMessageId" IS NULL
  AND campaign."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."scheduledAudienceCount" = 149
  AND campaign."deliveryScheduledAt" >= TIMESTAMPTZ '2026-07-29 03:36:00+00'
  AND campaign."deliveryScheduledAt" < TIMESTAMPTZ '2026-07-29 03:37:00+00'
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND campaign."scheduledRevisionId" = campaign."approvedRevisionId"
  AND (SELECT count(*) FROM "ReferralCommunication" all_invites
       WHERE all_invites."campaignId" = campaign."id"
         AND all_invites."kind" = 'INVITATION') = 149
  AND (SELECT count(*) FROM "ReferralCommunication" failed
       WHERE failed."campaignId" = campaign."id"
         AND failed."kind" = 'INVITATION'
         AND failed."status" = 'FAILED') = 50
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = campaign."id"
      AND sent."kind" = 'INVITATION'
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  );
