-- Contain only the known overdue, zero-send Helios referral schedule before the
-- corrected cron authentication contract becomes active. Every statement is
-- intentionally idempotent and preserves sent/provider history.

INSERT INTO "ReferralAuditEvent" (
  "id", "campaignId", "actorId", "action", "summary", "metadata", "createdAt"
)
SELECT
  'v1897contain' || substr(md5(c."id"), 1, 16),
  c."id",
  NULL,
  'OVERDUE_SCHEDULE_CONTAINED_FOR_CRON_AUTH_REMEDIATION',
  'Contained the overdue zero-send schedule before cron authentication remediation.',
  jsonb_build_object(
    'previousSchedule', c."deliveryScheduledAt",
    'scheduleVersion', c."scheduleVersion",
    'reason', 'CRON_AUTH_REMEDIATION',
    'release', 'V1.8.9.7'
  ),
  CURRENT_TIMESTAMP
FROM "ReferralCampaign" c
WHERE c."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND c."preparedAdvocateCount" = 149
  AND c."deliveryScheduledAt" IS NOT NULL
  AND c."deliveryScheduledAt" <= CURRENT_TIMESTAMP
  AND c."scheduleConfirmedAt" IS NOT NULL
  AND c."executionAuthorizedAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = c."id"
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  )
ON CONFLICT ("id") DO NOTHING;

UPDATE "ReferralCommunication" communication
SET
  "status" = 'APPROVED',
  "scheduledAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ReferralCampaign" campaign
WHERE communication."campaignId" = campaign."id"
  AND campaign."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."deliveryScheduledAt" IS NOT NULL
  AND campaign."deliveryScheduledAt" <= CURRENT_TIMESTAMP
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND communication."status" IN ('APPROVED', 'SCHEDULED')
  AND communication."sentAt" IS NULL
  AND communication."providerMessageId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = campaign."id"
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  );

UPDATE "ReferralInvitation" invitation
SET
  "status" = 'APPROVED',
  "scheduledAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ReferralCampaign" campaign
WHERE invitation."campaignId" = campaign."id"
  AND campaign."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."deliveryScheduledAt" IS NOT NULL
  AND campaign."deliveryScheduledAt" <= CURRENT_TIMESTAMP
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND invitation."status" IN ('APPROVED', 'SCHEDULED')
  AND invitation."sentAt" IS NULL
  AND invitation."providerMessageId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = campaign."id"
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
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
  "updatedAt" = CURRENT_TIMESTAMP
WHERE campaign."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."deliveryScheduledAt" IS NOT NULL
  AND campaign."deliveryScheduledAt" <= CURRENT_TIMESTAMP
  AND campaign."scheduleConfirmedAt" IS NOT NULL
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = campaign."id"
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  );
