CREATE TYPE "SocialAutopilotWeekStatus" AS ENUM ('GENERATING', 'DRAFT_REVIEW_REQUIRED', 'PARTIALLY_APPROVED', 'APPROVED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "SocialAutopilotRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED');
CREATE TYPE "SocialAutopilotVerificationStatus" AS ENUM ('VERIFIED', 'VERIFIED_WITH_SOURCES', 'NEEDS_REVIEW', 'BLOCKED_MISSING_INFORMATION');

CREATE TABLE "SocialAutopilotSettings" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false,
  "postsPerWeek" INTEGER NOT NULL DEFAULT 4, "enabledPlatforms" JSONB NOT NULL,
  "preferredPublishingDays" JSONB NOT NULL, "preferredTimeWindows" JSONB NOT NULL,
  "contentMix" JSONB NOT NULL, "portfolioFirst" BOOLEAN NOT NULL DEFAULT true,
  "aiImagesEnabled" BOOLEAN NOT NULL DEFAULT false, "seasonalContentEnabled" BOOLEAN NOT NULL DEFAULT true,
  "educationalEnabled" BOOLEAN NOT NULL DEFAULT true, "externalResearchEnabled" BOOLEAN NOT NULL DEFAULT false,
  "promotionalLimit" INTEGER NOT NULL DEFAULT 1, "geographicMarket" TEXT, "hashtagLimit" INTEGER NOT NULL DEFAULT 5,
  "notificationRecipients" JSONB NOT NULL, "generationDay" INTEGER NOT NULL DEFAULT 1,
  "generationLocalTime" TEXT NOT NULL DEFAULT '08:00', "timeZone" TEXT NOT NULL DEFAULT 'America/Denver',
  "reminderHours" JSONB NOT NULL, "contentCooldowns" JSONB NOT NULL, "callsToAction" JSONB NOT NULL,
  "exclusions" JSONB NOT NULL, "nextGenerationAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SocialAutopilotSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SocialAutopilotWeek" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "weekStart" TIMESTAMP(3) NOT NULL, "weekEnd" TIMESTAMP(3) NOT NULL,
  "status" "SocialAutopilotWeekStatus" NOT NULL DEFAULT 'GENERATING', "inputDigest" TEXT NOT NULL,
  "generationVersion" INTEGER NOT NULL DEFAULT 1, "lockedAt" TIMESTAMP(3), "lockedBy" TEXT,
  "reviewNotifiedAt" TIMESTAMP(3), "reminderSentAt" TIMESTAMP(3), "lastErrorCode" TEXT, "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialAutopilotWeek_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SocialAutopilotDraft" (
  "id" TEXT NOT NULL, "weekId" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "pillar" TEXT NOT NULL,
  "reasoning" TEXT, "verificationStatus" "SocialAutopilotVerificationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "sourceReferences" JSONB, "externalSources" JSONB, "suggestedAt" TIMESTAMP(3), "rejectedAt" TIMESTAMP(3),
  "revisionRequest" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialAutopilotDraft_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SocialAutopilotRun" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "weekId" TEXT, "idempotencyKey" TEXT NOT NULL,
  "trigger" TEXT NOT NULL, "status" "SocialAutopilotRunStatus" NOT NULL DEFAULT 'PENDING', "step" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "nextRetryAt" TIMESTAMP(3),
  "errorCode" TEXT, "errorMessage" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SocialAutopilotRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialAutopilotSettings_workspaceId_key" ON "SocialAutopilotSettings"("workspaceId");
CREATE UNIQUE INDEX "SocialAutopilotWeek_workspaceId_weekStart_key" ON "SocialAutopilotWeek"("workspaceId", "weekStart");
CREATE INDEX "SocialAutopilotWeek_workspaceId_status_weekStart_idx" ON "SocialAutopilotWeek"("workspaceId", "status", "weekStart");
CREATE UNIQUE INDEX "SocialAutopilotDraft_campaignId_key" ON "SocialAutopilotDraft"("campaignId");
CREATE INDEX "SocialAutopilotDraft_weekId_suggestedAt_idx" ON "SocialAutopilotDraft"("weekId", "suggestedAt");
CREATE UNIQUE INDEX "SocialAutopilotRun_idempotencyKey_key" ON "SocialAutopilotRun"("idempotencyKey");
CREATE INDEX "SocialAutopilotRun_workspaceId_status_createdAt_idx" ON "SocialAutopilotRun"("workspaceId", "status", "createdAt");
CREATE INDEX "SocialAutopilotRun_weekId_createdAt_idx" ON "SocialAutopilotRun"("weekId", "createdAt");
ALTER TABLE "SocialAutopilotSettings" ADD CONSTRAINT "SocialAutopilotSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAutopilotWeek" ADD CONSTRAINT "SocialAutopilotWeek_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAutopilotDraft" ADD CONSTRAINT "SocialAutopilotDraft_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "SocialAutopilotWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAutopilotDraft" ADD CONSTRAINT "SocialAutopilotDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialAutopilotRun" ADD CONSTRAINT "SocialAutopilotRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAutopilotRun" ADD CONSTRAINT "SocialAutopilotRun_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "SocialAutopilotWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;
