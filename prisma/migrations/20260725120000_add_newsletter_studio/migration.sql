CREATE TYPE "CommunicationEmailStatus" AS ENUM ('VALID', 'INVALID', 'BOUNCED', 'COMPLAINED');
CREATE TYPE "NewsletterSeriesStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "NewsletterEditionStatus" AS ENUM ('AWAITING_GENERATION', 'GENERATING', 'DRAFT_GENERATED', 'NEEDS_REVIEW', 'APPROVED', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'MISSED_APPROVAL', 'GENERATION_FAILED', 'SEND_FAILED', 'PARTIALLY_SENT', 'CANCELLED');
CREATE TYPE "NewsletterBlockType" AS ENUM ('HERO', 'OPENING_NOTE', 'FEATURED_STORY', 'PORTFOLIO_SPOTLIGHT', 'HELPFUL_TIP', 'SERVICE_SPOTLIGHT', 'EVENT_ANNOUNCEMENT', 'IMAGE', 'CALL_TO_ACTION', 'DIVIDER', 'SPACER', 'CLOSING_NOTE');
CREATE TYPE "NewsletterRecurrenceKind" AS ENUM ('DAY_OF_MONTH', 'NTH_WEEKDAY');
CREATE TYPE "NewsletterWeekOrdinal" AS ENUM ('FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST');
CREATE TYPE "NewsletterGenerationMode" AS ENUM ('RECURRENCE', 'DAYS_BEFORE_SEND', 'MANUAL');
CREATE TYPE "NewsletterGenerationStatus" AS ENUM ('CLAIMED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'INSUFFICIENT_CONTENT');
CREATE TYPE "NewsletterJobType" AS ENUM ('GENERATE', 'SEND', 'MISSED_APPROVAL', 'NOTIFY');
CREATE TYPE "NewsletterJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TABLE "CommunicationClient"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "emailStatus" "CommunicationEmailStatus" NOT NULL DEFAULT 'VALID',
ADD COLUMN "emailStatusUpdatedAt" TIMESTAMP(3);

CREATE TABLE "CommunicationSuppression" (
  "id" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "provider" TEXT,
  "providerEventId" TEXT,
  "clientId" TEXT,
  "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationSuppression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterSeries" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "NewsletterSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
  "timeZone" TEXT NOT NULL DEFAULT 'America/Denver',
  "senderName" TEXT,
  "senderEmail" TEXT,
  "replyTo" TEXT,
  "brandInstructions" TEXT,
  "toneInstructions" TEXT,
  "goals" TEXT,
  "defaultContentPreferences" JSONB,
  "defaultCallToAction" JSONB,
  "sendRecurrenceKind" "NewsletterRecurrenceKind" NOT NULL,
  "sendDayOfMonth" INTEGER,
  "sendWeekOrdinal" "NewsletterWeekOrdinal",
  "sendWeekday" INTEGER,
  "sendLocalTime" TEXT NOT NULL,
  "generationMode" "NewsletterGenerationMode" NOT NULL,
  "generationRecurrenceKind" "NewsletterRecurrenceKind",
  "generationDayOfMonth" INTEGER,
  "generationWeekOrdinal" "NewsletterWeekOrdinal",
  "generationWeekday" INTEGER,
  "generationLocalTime" TEXT,
  "generationDaysBeforeSend" INTEGER,
  "nextGenerationAt" TIMESTAMP(3),
  "nextSendAt" TIMESTAMP(3),
  "lastGeneratedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NewsletterSeries_send_schedule_check" CHECK (
    ("sendRecurrenceKind" = 'DAY_OF_MONTH' AND "sendDayOfMonth" BETWEEN 1 AND 31 AND "sendWeekOrdinal" IS NULL AND "sendWeekday" IS NULL)
    OR ("sendRecurrenceKind" = 'NTH_WEEKDAY' AND "sendDayOfMonth" IS NULL AND "sendWeekOrdinal" IS NOT NULL AND "sendWeekday" BETWEEN 0 AND 6)
  ),
  CONSTRAINT "NewsletterSeries_generation_schedule_check" CHECK (
    ("generationMode" = 'MANUAL' AND "generationRecurrenceKind" IS NULL AND "generationDaysBeforeSend" IS NULL)
    OR ("generationMode" = 'DAYS_BEFORE_SEND' AND "generationDaysBeforeSend" BETWEEN 0 AND 62)
    OR ("generationMode" = 'RECURRENCE' AND "generationRecurrenceKind" IS NOT NULL)
  ),
  CONSTRAINT "NewsletterSeries_send_time_check" CHECK ("sendLocalTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE TABLE "NewsletterSeriesGroup" (
  "seriesId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterSeriesGroup_pkey" PRIMARY KEY ("seriesId", "groupId")
);

CREATE TABLE "NewsletterSeriesRecipient" (
  "seriesId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterSeriesRecipient_pkey" PRIMARY KEY ("seriesId", "clientId")
);

CREATE TABLE "NewsletterEdition" (
  "id" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "cycleKey" TEXT NOT NULL,
  "status" "NewsletterEditionStatus" NOT NULL DEFAULT 'AWAITING_GENERATION',
  "subject" TEXT,
  "subjectAlternatives" JSONB,
  "previewText" TEXT,
  "contentNotes" JSONB,
  "internalNotes" TEXT,
  "intendedSendAt" TIMESTAMP(3) NOT NULL,
  "generationDueAt" TIMESTAMP(3),
  "approvedRevisionId" TEXT,
  "currentRevisionNumber" INTEGER NOT NULL DEFAULT 0,
  "rowVersion" INTEGER NOT NULL DEFAULT 0,
  "warnings" JSONB,
  "cancelledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterEdition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterBlock" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "type" "NewsletterBlockType" NOT NULL,
  "position" INTEGER NOT NULL,
  "internalLabel" TEXT,
  "content" JSONB NOT NULL,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
  "contentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterBlockSource" (
  "id" TEXT NOT NULL,
  "blockId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceTitle" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterBlockSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterRevision" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "previewText" TEXT,
  "blocksSnapshot" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "changeSummary" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterGenerationRun" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "status" "NewsletterGenerationStatus" NOT NULL,
  "model" TEXT,
  "promptVersion" TEXT NOT NULL,
  "instructionsSnapshot" JSONB NOT NULL,
  "sourceManifest" JSONB NOT NULL,
  "outputSnapshot" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "NewsletterGenerationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterApproval" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedSendAt" TIMESTAMP(3) NOT NULL,
  "estimatedEligibleCount" INTEGER NOT NULL,
  "estimatedExcludedCount" INTEGER NOT NULL,
  "recipientSelectionSnapshot" JSONB NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterDelivery" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "recipientSnapshot" JSONB NOT NULL,
  "eligibleCount" INTEGER NOT NULL,
  "excludedCount" INTEGER NOT NULL,
  "contentHash" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterJob" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "type" "NewsletterJobType" NOT NULL,
  "status" "NewsletterJobStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "claimToken" TEXT,
  "claimedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationSuppression_providerEventId_key" ON "CommunicationSuppression"("providerEventId");
CREATE INDEX "CommunicationSuppression_normalizedEmail_releasedAt_idx" ON "CommunicationSuppression"("normalizedEmail", "releasedAt");
CREATE INDEX "CommunicationSuppression_clientId_releasedAt_idx" ON "CommunicationSuppression"("clientId", "releasedAt");
CREATE INDEX "CommunicationClient_emailSubscribed_emailStatus_archivedAt_idx" ON "CommunicationClient"("emailSubscribed", "emailStatus", "archivedAt");
CREATE INDEX "NewsletterSeries_status_nextGenerationAt_idx" ON "NewsletterSeries"("status", "nextGenerationAt");
CREATE INDEX "NewsletterSeries_status_nextSendAt_idx" ON "NewsletterSeries"("status", "nextSendAt");
CREATE INDEX "NewsletterSeries_createdById_idx" ON "NewsletterSeries"("createdById");
CREATE INDEX "NewsletterSeriesGroup_groupId_idx" ON "NewsletterSeriesGroup"("groupId");
CREATE INDEX "NewsletterSeriesRecipient_clientId_idx" ON "NewsletterSeriesRecipient"("clientId");
CREATE UNIQUE INDEX "NewsletterEdition_seriesId_cycleKey_key" ON "NewsletterEdition"("seriesId", "cycleKey");
CREATE UNIQUE INDEX "NewsletterEdition_approvedRevisionId_key" ON "NewsletterEdition"("approvedRevisionId");
CREATE INDEX "NewsletterEdition_status_intendedSendAt_idx" ON "NewsletterEdition"("status", "intendedSendAt");
CREATE INDEX "NewsletterEdition_status_generationDueAt_idx" ON "NewsletterEdition"("status", "generationDueAt");
CREATE INDEX "NewsletterEdition_createdById_idx" ON "NewsletterEdition"("createdById");
CREATE UNIQUE INDEX "NewsletterBlock_editionId_position_key" ON "NewsletterBlock"("editionId", "position");
CREATE INDEX "NewsletterBlock_editionId_type_idx" ON "NewsletterBlock"("editionId", "type");
CREATE INDEX "NewsletterBlockSource_blockId_idx" ON "NewsletterBlockSource"("blockId");
CREATE INDEX "NewsletterBlockSource_sourceType_sourceId_idx" ON "NewsletterBlockSource"("sourceType", "sourceId");
CREATE UNIQUE INDEX "NewsletterRevision_editionId_revisionNumber_key" ON "NewsletterRevision"("editionId", "revisionNumber");
CREATE INDEX "NewsletterRevision_editionId_createdAt_idx" ON "NewsletterRevision"("editionId", "createdAt");
CREATE INDEX "NewsletterRevision_contentHash_idx" ON "NewsletterRevision"("contentHash");
CREATE INDEX "NewsletterRevision_createdById_idx" ON "NewsletterRevision"("createdById");
CREATE UNIQUE INDEX "NewsletterGenerationRun_editionId_attempt_key" ON "NewsletterGenerationRun"("editionId", "attempt");
CREATE INDEX "NewsletterGenerationRun_status_startedAt_idx" ON "NewsletterGenerationRun"("status", "startedAt");
CREATE INDEX "NewsletterApproval_editionId_approvedAt_idx" ON "NewsletterApproval"("editionId", "approvedAt");
CREATE INDEX "NewsletterApproval_approvedById_approvedAt_idx" ON "NewsletterApproval"("approvedById", "approvedAt");
CREATE INDEX "NewsletterApproval_revisionId_idx" ON "NewsletterApproval"("revisionId");
CREATE UNIQUE INDEX "NewsletterDelivery_editionId_key" ON "NewsletterDelivery"("editionId");
CREATE UNIQUE INDEX "NewsletterDelivery_campaignId_key" ON "NewsletterDelivery"("campaignId");
CREATE UNIQUE INDEX "NewsletterJob_idempotencyKey_key" ON "NewsletterJob"("idempotencyKey");
CREATE UNIQUE INDEX "NewsletterJob_claimToken_key" ON "NewsletterJob"("claimToken");
CREATE UNIQUE INDEX "NewsletterJob_editionId_type_dueAt_key" ON "NewsletterJob"("editionId", "type", "dueAt");
CREATE INDEX "NewsletterJob_status_dueAt_idx" ON "NewsletterJob"("status", "dueAt");
CREATE INDEX "NewsletterJob_editionId_type_idx" ON "NewsletterJob"("editionId", "type");

ALTER TABLE "CommunicationSuppression" ADD CONSTRAINT "CommunicationSuppression_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NewsletterSeries" ADD CONSTRAINT "NewsletterSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterSeriesGroup" ADD CONSTRAINT "NewsletterSeriesGroup_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "NewsletterSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsletterSeriesGroup" ADD CONSTRAINT "NewsletterSeriesGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunicationGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterSeriesRecipient" ADD CONSTRAINT "NewsletterSeriesRecipient_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "NewsletterSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsletterSeriesRecipient" ADD CONSTRAINT "NewsletterSeriesRecipient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterEdition" ADD CONSTRAINT "NewsletterEdition_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "NewsletterSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterEdition" ADD CONSTRAINT "NewsletterEdition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterBlock" ADD CONSTRAINT "NewsletterBlock_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "NewsletterEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsletterBlockSource" ADD CONSTRAINT "NewsletterBlockSource_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "NewsletterBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsletterRevision" ADD CONSTRAINT "NewsletterRevision_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "NewsletterEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsletterRevision" ADD CONSTRAINT "NewsletterRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NewsletterEdition" ADD CONSTRAINT "NewsletterEdition_approvedRevisionId_fkey" FOREIGN KEY ("approvedRevisionId") REFERENCES "NewsletterRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterGenerationRun" ADD CONSTRAINT "NewsletterGenerationRun_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "NewsletterEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsletterApproval" ADD CONSTRAINT "NewsletterApproval_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "NewsletterEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterApproval" ADD CONSTRAINT "NewsletterApproval_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "NewsletterRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterApproval" ADD CONSTRAINT "NewsletterApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterDelivery" ADD CONSTRAINT "NewsletterDelivery_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "NewsletterEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterDelivery" ADD CONSTRAINT "NewsletterDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewsletterJob" ADD CONSTRAINT "NewsletterJob_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "NewsletterEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
