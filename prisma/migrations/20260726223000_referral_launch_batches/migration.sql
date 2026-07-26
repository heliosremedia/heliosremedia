ALTER TYPE "ReferralCampaignStatus" ADD VALUE IF NOT EXISTS 'LAUNCHING';

ALTER TABLE "ReferralCampaign"
  ADD COLUMN "launchStartedAt" TIMESTAMP(3),
  ADD COLUMN "launchCompletedAt" TIMESTAMP(3),
  ADD COLUMN "launchFailedAt" TIMESTAMP(3),
  ADD COLUMN "launchLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "launchingAdminId" TEXT,
  ADD COLUMN "launchRevisionId" TEXT,
  ADD COLUMN "launchAttemptId" TEXT,
  ADD COLUMN "expectedAdvocateCount" INTEGER,
  ADD COLUMN "preparedAdvocateCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "preparedInvitationCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "preparedCommunicationCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "launchBatch" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastLaunchError" TEXT;

ALTER TABLE "ReferralInvitation"
  ADD COLUMN "approvedRevisionId" TEXT;

CREATE UNIQUE INDEX "ReferralCampaign_launchAttemptId_key"
  ON "ReferralCampaign"("launchAttemptId");
CREATE INDEX "ReferralCampaign_status_launchLeaseExpiresAt_idx"
  ON "ReferralCampaign"("status", "launchLeaseExpiresAt");
CREATE UNIQUE INDEX "ReferralInvitation_campaignId_advocateId_approvedRevisionId_key"
  ON "ReferralInvitation"("campaignId", "advocateId", "approvedRevisionId");
