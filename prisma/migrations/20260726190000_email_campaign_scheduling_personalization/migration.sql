ALTER TYPE "EmailCampaignStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "EmailCampaignStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "EmailCampaignStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "EmailCampaign"
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "scheduledTimeZone" TEXT,
  ADD COLUMN "scheduledById" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "scheduleError" TEXT,
  ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "CampaignRecipient"
  ADD COLUMN "firstNameSnapshot" TEXT,
  ADD COLUMN "lastNameSnapshot" TEXT,
  ADD COLUMN "fullNameSnapshot" TEXT,
  ADD COLUMN "phoneSnapshot" TEXT;

CREATE INDEX "EmailCampaign_status_scheduledAt_idx"
  ON "EmailCampaign"("status", "scheduledAt");
