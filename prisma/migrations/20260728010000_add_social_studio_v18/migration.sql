CREATE TYPE "SocialSourceType" AS ENUM ('PROJECT', 'PORTFOLIO_ITEM', 'MEDIA_LIBRARY', 'BLOG', 'NEWSLETTER', 'UPLOADED_IMAGE', 'UPLOADED_VIDEO', 'AI_GENERATED_IMAGE', 'BLANK');
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'TIKTOK');
CREATE TYPE "SocialVariantStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'SCHEDULED', 'READY_TO_PUBLISH', 'PUBLISHED', 'FAILED', 'ARCHIVED');
CREATE TYPE "SocialApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REVOKED', 'RESTORED');
CREATE TYPE "SocialConnectionState" AS ENUM ('NOT_CONFIGURED', 'MANUAL_WORKFLOW', 'CONNECTION_PLANNED', 'CONNECTED', 'REAUTHORIZATION_REQUIRED');

CREATE TABLE "SocialCampaign" (
  "id" TEXT NOT NULL,
  "internalName" TEXT NOT NULL,
  "purpose" TEXT,
  "sourceType" "SocialSourceType" NOT NULL,
  "sourceRecordIds" JSONB,
  "verifiedSourceFacts" JSONB,
  "targetAudience" TEXT,
  "primaryMessage" TEXT,
  "objective" TEXT,
  "desiredCallToAction" TEXT,
  "destinationLink" TEXT,
  "selectedPlatforms" JSONB NOT NULL,
  "scheduleNotes" TEXT,
  "internalAiInstructions" TEXT,
  "generationStatus" TEXT,
  "generationError" TEXT,
  "generationRequestId" TEXT,
  "sourceProjectId" TEXT,
  "createdById" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialVariant" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "postType" TEXT NOT NULL,
  "status" "SocialVariantStatus" NOT NULL DEFAULT 'DRAFT',
  "caption" TEXT,
  "openingHook" TEXT,
  "hashtags" JSONB,
  "callToAction" TEXT,
  "destinationLink" TEXT,
  "altText" TEXT,
  "onScreenText" TEXT,
  "videoConcept" TEXT,
  "suggestedCover" TEXT,
  "platformNotes" TEXT,
  "internalNotes" TEXT,
  "aiMetadata" JSONB,
  "contentVersion" INTEGER NOT NULL DEFAULT 1,
  "scheduledAt" TIMESTAMP(3),
  "scheduledTimeZone" TEXT NOT NULL DEFAULT 'America/Denver',
  "scheduleVersion" INTEGER NOT NULL DEFAULT 0,
  "readyProcessedAt" TIMESTAMP(3),
  "approvalActorId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "publicUrl" TEXT,
  "publicationNotes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "lastEditedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialVariantMedia" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "altText" TEXT,
  "cropAspect" TEXT,
  "cropX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "cropY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "cropScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialVariantMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialApprovalEvent" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" "SocialApprovalAction" NOT NULL,
  "contentVersion" INTEGER NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPublication" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "publicUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialStudioSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "brandVoice" TEXT NOT NULL,
  "primaryAudience" TEXT NOT NULL,
  "writingGuardrails" TEXT NOT NULL,
  "defaultCallToAction" TEXT,
  "hashtagGuidance" TEXT,
  "platformGuidance" JSONB,
  "prohibitedTopics" TEXT,
  "cadenceGoals" JSONB,
  "timeZone" TEXT NOT NULL DEFAULT 'America/Denver',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialStudioSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialConnection" (
  "id" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "state" "SocialConnectionState" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "intendedAccountName" TEXT,
  "supportedWorkflow" TEXT NOT NULL DEFAULT 'Manual publishing and export',
  "manualPublishingUrl" TEXT,
  "configurationMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialCampaign_generationRequestId_key" ON "SocialCampaign"("generationRequestId");
CREATE INDEX "SocialCampaign_createdById_updatedAt_idx" ON "SocialCampaign"("createdById", "updatedAt");
CREATE INDEX "SocialCampaign_sourceType_sourceProjectId_idx" ON "SocialCampaign"("sourceType", "sourceProjectId");
CREATE INDEX "SocialCampaign_archivedAt_updatedAt_idx" ON "SocialCampaign"("archivedAt", "updatedAt");
CREATE UNIQUE INDEX "SocialVariant_campaignId_platform_key" ON "SocialVariant"("campaignId", "platform");
CREATE INDEX "SocialVariant_status_scheduledAt_idx" ON "SocialVariant"("status", "scheduledAt");
CREATE INDEX "SocialVariant_campaignId_status_idx" ON "SocialVariant"("campaignId", "status");
CREATE INDEX "SocialVariant_platform_status_idx" ON "SocialVariant"("platform", "status");
CREATE UNIQUE INDEX "SocialVariantMedia_variantId_mediaId_key" ON "SocialVariantMedia"("variantId", "mediaId");
CREATE INDEX "SocialVariantMedia_variantId_displayOrder_idx" ON "SocialVariantMedia"("variantId", "displayOrder");
CREATE INDEX "SocialVariantMedia_mediaId_idx" ON "SocialVariantMedia"("mediaId");
CREATE INDEX "SocialApprovalEvent_variantId_createdAt_idx" ON "SocialApprovalEvent"("variantId", "createdAt");
CREATE INDEX "SocialApprovalEvent_actorId_createdAt_idx" ON "SocialApprovalEvent"("actorId", "createdAt");
CREATE INDEX "SocialPublication_variantId_publishedAt_idx" ON "SocialPublication"("variantId", "publishedAt");
CREATE INDEX "SocialPublication_actorId_publishedAt_idx" ON "SocialPublication"("actorId", "publishedAt");
CREATE UNIQUE INDEX "SocialConnection_platform_key" ON "SocialConnection"("platform");

ALTER TABLE "SocialCampaign" ADD CONSTRAINT "SocialCampaign_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialCampaign" ADD CONSTRAINT "SocialCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialVariant" ADD CONSTRAINT "SocialVariant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialVariant" ADD CONSTRAINT "SocialVariant_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialVariantMedia" ADD CONSTRAINT "SocialVariantMedia_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SocialVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialVariantMedia" ADD CONSTRAINT "SocialVariantMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialApprovalEvent" ADD CONSTRAINT "SocialApprovalEvent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SocialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialApprovalEvent" ADD CONSTRAINT "SocialApprovalEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SocialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SocialStudioSettings" ("id", "brandVoice", "primaryAudience", "writingGuardrails", "defaultCallToAction", "hashtagGuidance", "platformGuidance", "prohibitedTopics", "updatedAt")
VALUES (
  'default',
  'Refined, confident, thoughtful, visually driven, premium but approachable. Clear and human without sounding overly promotional, generic, or automated.',
  'Real estate agents, brokers, teams, builders, designers, and property-marketing professionals—primarily within Northern Colorado.',
  'Never invent statistics, market conditions, property details, client outcomes, testimonials, pricing, awards, or service claims. Avoid clickbait, keyword stuffing, generic AI language, and excessive hashtags.',
  'Invite the audience to explore the relevant Helios work or service when appropriate.',
  'Use a selective set of specific, relevant hashtags. Avoid stuffing and generic reach-bait tags.',
  '{"INSTAGRAM":"Lead with the visual story; concise copy and selective hashtags.","FACEBOOK":"Use conversational context and readable paragraphs.","LINKEDIN":"Offer professional insight and a clear point of view.","TIKTOK":"Open immediately; keep captions short and suggest on-screen structure."}',
  'Unsupported claims, fabricated results, politics, legal advice, and representation of AI imagery as authentic Helios property photography.',
  CURRENT_TIMESTAMP
);

INSERT INTO "SocialConnection" ("id", "platform", "state", "intendedAccountName", "manualPublishingUrl", "updatedAt") VALUES
  ('social-instagram', 'INSTAGRAM', 'MANUAL_WORKFLOW', '@heliosrealestatemedia', 'https://www.instagram.com/', CURRENT_TIMESTAMP),
  ('social-facebook', 'FACEBOOK', 'MANUAL_WORKFLOW', 'Helios Real Estate Media', 'https://www.facebook.com/', CURRENT_TIMESTAMP),
  ('social-linkedin', 'LINKEDIN', 'MANUAL_WORKFLOW', 'Helios Real Estate Media', 'https://www.linkedin.com/', CURRENT_TIMESTAMP),
  ('social-tiktok', 'TIKTOK', 'MANUAL_WORKFLOW', '@heliosrealestatemedia', 'https://www.tiktok.com/', CURRENT_TIMESTAMP);
