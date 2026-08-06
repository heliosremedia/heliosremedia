-- Recover the exact 149-recipient referral campaign whose initial invitations
-- failed before any provider message was accepted. This migration never sends
-- email. It only returns unsent records to an approved, unscheduled state.

INSERT INTO "ReferralAuditEvent" (
  "id", "campaignId", "actorId", "action", "summary", "metadata", "createdAt"
)
SELECT
  'v1948refrecover' || substr(md5(c."id"), 1, 10),
  c."id",
  NULL,
  'ZERO_DELIVERY_REFERRAL_RECOVERY_AUTHORIZED',
  'Recovered the exact zero-delivery referral campaign and removed its invalid follow-up schedule.',
  jsonb_build_object(
    'recoveredInvitations', 149,
    'clearedFollowUps', 447,
    'release', 'V1.9.4.8'
  ),
  CURRENT_TIMESTAMP
FROM "ReferralCampaign" c
WHERE c."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND c."status" = 'APPROVED'
  AND c."expectedAdvocateCount" = 149
  AND c."preparedAdvocateCount" = 149
  AND c."approvedRevisionId" IS NOT NULL
  AND (SELECT count(*) FROM "ReferralInvitation" i
       WHERE i."campaignId" = c."id") = 149
  AND (SELECT count(*) FROM "ReferralInvitation" i
       WHERE i."campaignId" = c."id"
         AND i."status" = 'FAILED'
         AND i."sentAt" IS NULL
         AND i."providerMessageId" IS NULL) = 149
  AND (SELECT count(*) FROM "ReferralCommunication" rc
       WHERE rc."campaignId" = c."id"
         AND rc."kind" = 'INVITATION'
         AND rc."status" = 'FAILED'
         AND rc."sentAt" IS NULL
         AND rc."providerMessageId" IS NULL) = 149
  AND (SELECT count(*) FROM "ReferralCommunication" rc
       WHERE rc."campaignId" = c."id"
         AND rc."kind" = 'FOLLOW_UP'
         AND rc."status" = 'SCHEDULED') = 447
  AND NOT EXISTS (
    SELECT 1
    FROM "ReferralCommunication" evidence
    WHERE evidence."campaignId" = c."id"
      AND (evidence."sentAt" IS NOT NULL OR evidence."providerMessageId" IS NOT NULL)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "ReferralInvitation" evidence
    WHERE evidence."campaignId" = c."id"
      AND (evidence."sentAt" IS NOT NULL OR evidence."providerMessageId" IS NOT NULL)
  )
ON CONFLICT ("id") DO NOTHING;

UPDATE "ReferralCommunication" communication
SET
  "status" = 'APPROVED',
  "scheduledAt" = NULL,
  "failureCode" = NULL,
  "failureMessage" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ReferralCampaign" campaign
WHERE communication."campaignId" = campaign."id"
  AND communication."sentAt" IS NULL
  AND communication."providerMessageId" IS NULL
  AND (
    (communication."kind" = 'INVITATION' AND communication."status" = 'FAILED')
    OR
    (communication."kind" = 'FOLLOW_UP' AND communication."status" = 'SCHEDULED')
  )
  AND EXISTS (
    SELECT 1
    FROM "ReferralAuditEvent" recovery
    WHERE recovery."campaignId" = campaign."id"
      AND recovery."action" = 'ZERO_DELIVERY_REFERRAL_RECOVERY_AUTHORIZED'
      AND recovery."metadata"->>'release' = 'V1.9.4.8'
  );

UPDATE "ReferralInvitation" invitation
SET
  "status" = 'APPROVED',
  "scheduledAt" = NULL,
  "failureCode" = NULL,
  "failureMessage" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ReferralCampaign" campaign
WHERE invitation."campaignId" = campaign."id"
  AND invitation."status" = 'FAILED'
  AND invitation."sentAt" IS NULL
  AND invitation."providerMessageId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "ReferralAuditEvent" recovery
    WHERE recovery."campaignId" = campaign."id"
      AND recovery."action" = 'ZERO_DELIVERY_REFERRAL_RECOVERY_AUTHORIZED'
      AND recovery."metadata"->>'release' = 'V1.9.4.8'
  );

UPDATE "ReferralCampaign" campaign
SET
  "status" = 'APPROVED',
  "deliveryScheduledAt" = NULL,
  "scheduleConfirmedAt" = NULL,
  "executionAuthorizedAt" = NULL,
  "scheduledById" = NULL,
  "scheduledRevisionId" = NULL,
  "scheduledAudienceCount" = NULL,
  "scheduleCancelledAt" = CURRENT_TIMESTAMP,
  "scheduleVersion" = campaign."scheduleVersion" + 1,
  "lastWorkerActivityAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM "ReferralAuditEvent" recovery
  WHERE recovery."campaignId" = campaign."id"
    AND recovery."action" = 'ZERO_DELIVERY_REFERRAL_RECOVERY_AUTHORIZED'
    AND recovery."metadata"->>'release' = 'V1.9.4.8'
);
