ALTER TABLE "ReferralCampaign"
  ADD COLUMN "scheduleVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scheduledRevisionId" TEXT,
  ADD COLUMN "scheduledAudienceCount" INTEGER,
  ADD COLUMN "scheduleCancelledAt" TIMESTAMP(3);

CREATE INDEX "ReferralCampaign_scheduledRevisionId_scheduleVersion_idx"
  ON "ReferralCampaign"("scheduledRevisionId", "scheduleVersion");
