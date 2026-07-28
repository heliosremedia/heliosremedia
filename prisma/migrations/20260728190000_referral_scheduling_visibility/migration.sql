ALTER TABLE "ReferralCampaign"
  ADD COLUMN "deliveryScheduledAt" TIMESTAMP(3),
  ADD COLUMN "deliveryTimezone" TEXT NOT NULL DEFAULT 'America/Denver',
  ADD COLUMN "scheduleConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "scheduledById" TEXT,
  ADD COLUMN "lastWorkerActivityAt" TIMESTAMP(3),
  ADD COLUMN "lastProviderActivityAt" TIMESTAMP(3);

CREATE INDEX "ReferralCampaign_scheduleConfirmedAt_deliveryScheduledAt_idx"
  ON "ReferralCampaign"("scheduleConfirmedAt", "deliveryScheduledAt");
