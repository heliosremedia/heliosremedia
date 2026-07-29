-- Contain the exact July 28 8:45 PM America/Denver referral schedule after
-- the first batch was rejected by the provider. Preserve all failed records,
-- and revoke the remaining schedule authorization before any later poll.

INSERT INTO "ReferralAuditEvent" (
  "id", "campaignId", "actorId", "action", "summary", "metadata", "createdAt"
)
SELECT
  'v1899contain' || substr(md5(c."id"), 1, 16),
  c."id",
  NULL,
  'PROVIDER_FAILURE_SCHEDULE_CONTAINED',
  'Contained the zero-send schedule after the provider rejected the first delivery batch.',
  jsonb_build_object(
    'previousSchedule', c."deliveryScheduledAt",
    'scheduleVersion', c."scheduleVersion",
    'failedCommunications', 50,
    'release', 'V1.8.9.9'
  ),
  CURRENT_TIMESTAMP
FROM "ReferralCampaign" c
WHERE c."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND c."preparedAdvocateCount" = 149
  AND c."deliveryScheduledAt" >= TIMESTAMPTZ '2026-07-29 02:45:00+00'
  AND c."deliveryScheduledAt" < TIMESTAMPTZ '2026-07-29 02:46:00+00'
  AND c."executionAuthorizedAt" IS NOT NULL
  AND (SELECT count(*) FROM "ReferralCommunication" f
       WHERE f."campaignId" = c."id" AND f."status" = 'FAILED') = 50
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = c."id"
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  )
ON CONFLICT ("id") DO NOTHING;

UPDATE "ReferralCommunication" communication
SET "status" = 'APPROVED', "scheduledAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
FROM "ReferralCampaign" campaign
WHERE communication."campaignId" = campaign."id"
  AND campaign."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."deliveryScheduledAt" >= TIMESTAMPTZ '2026-07-29 02:45:00+00'
  AND campaign."deliveryScheduledAt" < TIMESTAMPTZ '2026-07-29 02:46:00+00'
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND communication."status" = 'SCHEDULED'
  AND communication."sentAt" IS NULL
  AND communication."providerMessageId" IS NULL
  AND (SELECT count(*) FROM "ReferralCommunication" f
       WHERE f."campaignId" = campaign."id" AND f."status" = 'FAILED') = 50
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = campaign."id"
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  );

UPDATE "ReferralInvitation" invitation
SET "status" = 'APPROVED', "scheduledAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
FROM "ReferralCampaign" campaign
WHERE invitation."campaignId" = campaign."id"
  AND campaign."internalName" = 'Helios Client Referral Program — $50 Referral Reward'
  AND campaign."preparedAdvocateCount" = 149
  AND campaign."deliveryScheduledAt" >= TIMESTAMPTZ '2026-07-29 02:45:00+00'
  AND campaign."deliveryScheduledAt" < TIMESTAMPTZ '2026-07-29 02:46:00+00'
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND invitation."status" = 'SCHEDULED'
  AND invitation."sentAt" IS NULL
  AND invitation."providerMessageId" IS NULL
  AND (SELECT count(*) FROM "ReferralCommunication" f
       WHERE f."campaignId" = campaign."id" AND f."status" = 'FAILED') = 50
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
  AND campaign."deliveryScheduledAt" >= TIMESTAMPTZ '2026-07-29 02:45:00+00'
  AND campaign."deliveryScheduledAt" < TIMESTAMPTZ '2026-07-29 02:46:00+00'
  AND campaign."executionAuthorizedAt" IS NOT NULL
  AND (SELECT count(*) FROM "ReferralCommunication" f
       WHERE f."campaignId" = campaign."id" AND f."status" = 'FAILED') = 50
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralCommunication" sent
    WHERE sent."campaignId" = campaign."id"
      AND (sent."sentAt" IS NOT NULL OR sent."providerMessageId" IS NOT NULL)
  );
