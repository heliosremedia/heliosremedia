CREATE TYPE "SocialCampaignStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'APPROVED', 'ARCHIVED');
CREATE TYPE "SocialSeriesStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "SocialRecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY');
CREATE TYPE "SocialGeneratedAssetKind" AS ENUM ('AI_GENERATED', 'AI_ASSISTED_DERIVATIVE');

ALTER TYPE "SocialPlatform" ADD VALUE IF NOT EXISTS 'OTHER';
ALTER TYPE "SocialVariantStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "SocialApprovalAction" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';

ALTER TABLE "SocialCampaign"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "status" "SocialCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "brandVoice" TEXT,
  ADD COLUMN "internalNotes" TEXT,
  ADD COLUMN "startAt" TIMESTAMP(3),
  ADD COLUMN "endAt" TIMESTAMP(3),
  ADD COLUMN "lastEditedById" TEXT;

UPDATE "SocialCampaign" SET "lastEditedById" = "createdById" WHERE "lastEditedById" IS NULL;
ALTER TABLE "SocialCampaign" ALTER COLUMN "lastEditedById" SET NOT NULL;
ALTER TABLE "SocialCampaign" ADD CONSTRAINT "SocialCampaign_lastEditedById_fkey"
  FOREIGN KEY ("lastEditedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SocialCampaignProject" (
  "campaignId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCampaignProject_pkey" PRIMARY KEY ("campaignId", "projectId")
);

CREATE TABLE "SocialCampaignMedia" (
  "campaignId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCampaignMedia_pkey" PRIMARY KEY ("campaignId", "mediaId")
);

CREATE TABLE "SocialSeries" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "objective" TEXT,
  "defaultPlatforms" JSONB NOT NULL,
  "frequency" "SocialRecurrenceFrequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1,
  "dayOfWeek" INTEGER,
  "dayOfMonth" INTEGER,
  "localTime" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL DEFAULT 'America/Denver',
  "defaultTone" TEXT,
  "defaultCallToAction" TEXT,
  "promptGuidance" TEXT,
  "status" "SocialSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "generationThrough" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "lastEditedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialSeries_interval_check" CHECK ("interval" BETWEEN 1 AND 52),
  CONSTRAINT "SocialSeries_day_of_week_check" CHECK ("dayOfWeek" IS NULL OR "dayOfWeek" BETWEEN 0 AND 6),
  CONSTRAINT "SocialSeries_day_of_month_check" CHECK ("dayOfMonth" IS NULL OR "dayOfMonth" BETWEEN 1 AND 31),
  CONSTRAINT "SocialSeries_local_time_check" CHECK ("localTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE TABLE "SocialSeriesCampaign" (
  "seriesId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialSeriesCampaign_pkey" PRIMARY KEY ("seriesId", "campaignId")
);

CREATE TABLE "SocialSeriesOccurrence" (
  "id" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "campaignId" TEXT,
  "variantId" TEXT,
  "platform" "SocialPlatform" NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "timeZone" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "editedIndependently" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialSeriesOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialGeneratedAsset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "kind" "SocialGeneratedAssetKind" NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "sourceMediaId" TEXT,
  "promptDigest" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "disclosure" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialGeneratedAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialCampaign_workspaceId_status_updatedAt_idx" ON "SocialCampaign"("workspaceId", "status", "updatedAt");
CREATE INDEX "SocialCampaignProject_projectId_idx" ON "SocialCampaignProject"("projectId");
CREATE INDEX "SocialCampaignMedia_mediaId_idx" ON "SocialCampaignMedia"("mediaId");
CREATE INDEX "SocialSeries_workspaceId_status_updatedAt_idx" ON "SocialSeries"("workspaceId", "status", "updatedAt");
CREATE INDEX "SocialSeriesCampaign_campaignId_idx" ON "SocialSeriesCampaign"("campaignId");
CREATE UNIQUE INDEX "SocialSeriesOccurrence_seriesId_platform_scheduledAt_key" ON "SocialSeriesOccurrence"("seriesId", "platform", "scheduledAt");
CREATE INDEX "SocialSeriesOccurrence_seriesId_scheduledAt_idx" ON "SocialSeriesOccurrence"("seriesId", "scheduledAt");
CREATE INDEX "SocialSeriesOccurrence_campaignId_idx" ON "SocialSeriesOccurrence"("campaignId");
CREATE INDEX "SocialSeriesOccurrence_variantId_idx" ON "SocialSeriesOccurrence"("variantId");
CREATE INDEX "SocialGeneratedAsset_workspaceId_createdAt_idx" ON "SocialGeneratedAsset"("workspaceId", "createdAt");
CREATE INDEX "SocialGeneratedAsset_variantId_idx" ON "SocialGeneratedAsset"("variantId");
CREATE INDEX "SocialGeneratedAsset_sourceMediaId_idx" ON "SocialGeneratedAsset"("sourceMediaId");

ALTER TABLE "SocialCampaignProject" ADD CONSTRAINT "SocialCampaignProject_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialCampaignProject" ADD CONSTRAINT "SocialCampaignProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialCampaignMedia" ADD CONSTRAINT "SocialCampaignMedia_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialCampaignMedia" ADD CONSTRAINT "SocialCampaignMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialSeries" ADD CONSTRAINT "SocialSeries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialSeries" ADD CONSTRAINT "SocialSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialSeries" ADD CONSTRAINT "SocialSeries_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialSeriesCampaign" ADD CONSTRAINT "SocialSeriesCampaign_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "SocialSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialSeriesCampaign" ADD CONSTRAINT "SocialSeriesCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialSeriesOccurrence" ADD CONSTRAINT "SocialSeriesOccurrence_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "SocialSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialSeriesOccurrence" ADD CONSTRAINT "SocialSeriesOccurrence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialSeriesOccurrence" ADD CONSTRAINT "SocialSeriesOccurrence_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SocialVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialGeneratedAsset" ADD CONSTRAINT "SocialGeneratedAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialGeneratedAsset" ADD CONSTRAINT "SocialGeneratedAsset_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SocialVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialGeneratedAsset" ADD CONSTRAINT "SocialGeneratedAsset_sourceMediaId_fkey" FOREIGN KEY ("sourceMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialGeneratedAsset" ADD CONSTRAINT "SocialGeneratedAsset_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
