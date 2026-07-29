-- Repair the exact zero-send referral campaign after Resend confirmed that its
-- stored sender still used the unverified root domain. This migration acts only
-- on the post-fail-stop state: 149 unsent invitations, one FAILED communication,
-- 148 APPROVED communications, and no provider-message evidence.

INSERT INTO "ReferralAuditEvent" (
  "id", "campaignId", "actorId", "action", "summary", "metadata", "createdAt"
)
SELECT
  'v18911repair' || substr(md5(c."id"), 1, 13),
  c."id",
  NULL,
  'CAMPAIGN_SENDER_REPAIR_AUTHORIZED',
  'Authorized the exact-state stored-sender repair for 149 zero-send referral invitations.',
  jsonb_build_object(
    'senderDomain', 'mail.heliosrealestatemedia.com',
    'recoveredInvitationCommunications', 149,
    'release', 'V1.8.9.11'
  ),
  CURRENT_TIMESTAMP
FROM "ReferralCampaign" c
WHERE c."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND c."preparedAdvocateCount" = 149
  AND c."status" = 'APPROVED'
  AND c."deliveryScheduledAt" IS NULL
  AND c."scheduleConfirmedAt" IS NULL
  AND c."executionAuthorizedAt" IS NULL
  AND c."scheduledRevisionId" IS NULL
  AND c."approvedRevisionId" IS NOT NULL
  AND (SELECT count(*) FROM "ReferralCommunication" all_invites
       WHERE all_invites."campaignId" = c."id"
         AND all_invites."kind" = 'INVITATION') = 149
  AND (SELECT count(*) FROM "ReferralCommunication" failed
       WHERE failed."campaignId" = c."id"
         AND failed."kind" = 'INVITATION'
         AND failed."status" = 'FAILED') = 1
  AND (SELECT count(*) FROM "ReferralCommunication" approved
       WHERE approved."campaignId" = c."id"
         AND approved."kind" = 'INVITATION'
         AND approved."status" = 'APPROVED') = 148
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" delivered
    WHERE delivered."campaignId" = c."id"
      AND delivered."kind" = 'INVITATION'
      AND (
        delivered."status" = 'SENT'
        OR delivered."sentAt" IS NOT NULL
        OR delivered."providerMessageId" IS NOT NULL
      )
  )
ON CONFLICT ("id") DO NOTHING;

WITH eligible_campaign AS (
  SELECT event."campaignId" AS "id"
  FROM "ReferralAuditEvent" event
  WHERE event."action" = 'CAMPAIGN_SENDER_REPAIR_AUTHORIZED'
    AND event."metadata"->>'release' = 'V1.8.9.11'
)
UPDATE "ReferralCampaign" campaign
SET
  "senderName" = 'Helios Real Estate Media',
  "senderEmail" = 'referrals@mail.heliosrealestatemedia.com',
  "status" = 'APPROVED',
  "deliveryScheduledAt" = CURRENT_TIMESTAMP,
  "scheduleConfirmedAt" = CURRENT_TIMESTAMP,
  "executionAuthorizedAt" = CURRENT_TIMESTAMP,
  "scheduledRevisionId" = campaign."approvedRevisionId",
  "scheduledAudienceCount" = 149,
  "scheduleCancelledAt" = NULL,
  "scheduleVersion" = campaign."scheduleVersion" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
FROM eligible_campaign eligible
WHERE campaign."id" = eligible."id"
  AND campaign."deliveryScheduledAt" IS NULL
  AND campaign."executionAuthorizedAt" IS NULL;

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
  AND campaign."senderEmail" = 'referrals@mail.heliosrealestatemedia.com'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."scheduledAudienceCount" = 149
  AND campaign."deliveryScheduledAt" IS NOT NULL
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND campaign."scheduledRevisionId" = campaign."approvedRevisionId"
  AND EXISTS (
    SELECT 1 FROM "ReferralAuditEvent" repair
    WHERE repair."campaignId" = campaign."id"
      AND repair."action" = 'CAMPAIGN_SENDER_REPAIR_AUTHORIZED'
      AND repair."metadata"->>'release' = 'V1.8.9.11'
  )
  AND (SELECT count(*) FROM "ReferralCommunication" all_invites
       WHERE all_invites."campaignId" = campaign."id"
         AND all_invites."kind" = 'INVITATION') = 149
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" delivered
    WHERE delivered."campaignId" = campaign."id"
      AND delivered."kind" = 'INVITATION'
      AND (delivered."sentAt" IS NOT NULL OR delivered."providerMessageId" IS NOT NULL)
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
  AND campaign."senderEmail" = 'referrals@mail.heliosrealestatemedia.com'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."scheduledAudienceCount" = 149
  AND campaign."deliveryScheduledAt" IS NOT NULL
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND campaign."scheduledRevisionId" = campaign."approvedRevisionId"
  AND EXISTS (
    SELECT 1 FROM "ReferralAuditEvent" repair
    WHERE repair."campaignId" = campaign."id"
      AND repair."action" = 'CAMPAIGN_SENDER_REPAIR_AUTHORIZED'
      AND repair."metadata"->>'release' = 'V1.8.9.11'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" delivered
    WHERE delivered."campaignId" = campaign."id"
      AND delivered."kind" = 'INVITATION'
      AND (delivered."sentAt" IS NOT NULL OR delivered."providerMessageId" IS NOT NULL)
  );
