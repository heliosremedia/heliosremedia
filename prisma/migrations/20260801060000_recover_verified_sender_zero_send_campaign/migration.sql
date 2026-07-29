-- Recover the exact zero-send referral campaign after the stored sender repair
-- was blocked by an invalid assumption about the FAILED/APPROVED status split.
-- The provider rejection can leave any split after fail-stop containment, so
-- this migration relies on immutable campaign history and delivery evidence.

INSERT INTO "ReferralAuditEvent" (
  "id", "campaignId", "actorId", "action", "summary", "metadata", "createdAt"
)
SELECT
  'v18912recover' || substr(md5(c."id"), 1, 14),
  c."id",
  NULL,
  'VERIFIED_SENDER_ZERO_SEND_RECOVERY_AUTHORIZED',
  'Authorized one exact zero-send recovery after repairing the stored sender domain.',
  jsonb_build_object(
    'senderDomain', 'mail.heliosrealestatemedia.com',
    'recoveredInvitationCommunications', 149,
    'release', 'V1.8.9.12'
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
  AND EXISTS (
    SELECT 1
    FROM "ReferralAuditEvent" prior_recovery
    WHERE prior_recovery."campaignId" = c."id"
      AND prior_recovery."action" = 'ZERO_SEND_CAMPAIGN_RECOVERED'
      AND prior_recovery."metadata"->>'release' = 'V1.8.9.10'
  )
  AND EXISTS (
    SELECT 1
    FROM "ReferralAuditEvent" containment
    WHERE containment."campaignId" = c."id"
      AND containment."action" = 'PROVIDER_FAILURE_SCHEDULE_CONTAINED'
      AND containment."metadata"->>'release' = 'V1.8.9.9'
  )
  AND (SELECT count(*) FROM "ReferralCommunication" all_invites
       WHERE all_invites."campaignId" = c."id"
         AND all_invites."kind" = 'INVITATION') = 149
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
  WHERE event."action" = 'VERIFIED_SENDER_ZERO_SEND_RECOVERY_AUTHORIZED'
    AND event."metadata"->>'release' = 'V1.8.9.12'
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
  AND campaign."senderEmail" = 'referrals@mail.heliosrealestatemedia.com'
  AND campaign."deliveryScheduledAt" IS NOT NULL
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND campaign."scheduledRevisionId" = campaign."approvedRevisionId"
  AND EXISTS (
    SELECT 1 FROM "ReferralAuditEvent" recovery
    WHERE recovery."campaignId" = campaign."id"
      AND recovery."action" = 'VERIFIED_SENDER_ZERO_SEND_RECOVERY_AUTHORIZED'
      AND recovery."metadata"->>'release' = 'V1.8.9.12'
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
  AND campaign."senderEmail" = 'referrals@mail.heliosrealestatemedia.com'
  AND campaign."deliveryScheduledAt" IS NOT NULL
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND campaign."scheduledRevisionId" = campaign."approvedRevisionId"
  AND EXISTS (
    SELECT 1 FROM "ReferralAuditEvent" recovery
    WHERE recovery."campaignId" = campaign."id"
      AND recovery."action" = 'VERIFIED_SENDER_ZERO_SEND_RECOVERY_AUTHORIZED'
      AND recovery."metadata"->>'release' = 'V1.8.9.12'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" delivered
    WHERE delivered."campaignId" = campaign."id"
      AND delivered."kind" = 'INVITATION'
      AND (delivered."sentAt" IS NOT NULL OR delivered."providerMessageId" IS NOT NULL)
  );
