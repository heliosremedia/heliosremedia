-- V1.8.1 is additive. Existing connections and posts remain manual and no jobs
-- are created by this migration.
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'PROVIDER_CREDENTIALS_MISSING';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'APP_REVIEW_REQUIRED';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'READY_TO_CONNECT';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'CONNECTED_DIRECT_PUBLISHING_DISABLED';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'PERMISSION_MISSING';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'DISCONNECTED';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'ERROR';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'DRAFT_TRANSFER_ONLY';

CREATE TYPE "SocialPublishingJobStatus" AS ENUM ('SCHEDULED','VALIDATING','READY','PUBLISHING','PROVIDER_PROCESSING','PUBLISHED','TRANSFERRED_AS_DRAFT','REQUIRES_MANUAL_COMPLETION','DELAYED','RETRY_SCHEDULED','FAILED','CANCELLED','REAUTHORIZATION_REQUIRED','MANUAL_FALLBACK');
CREATE TYPE "SocialPublishingErrorCategory" AS ENUM ('AUTHENTICATION','PERMISSION','VALIDATION','RATE_LIMIT','TRANSIENT','PROVIDER_PROCESSING','AMBIGUOUS','CONFIGURATION','CANCELLED','UNKNOWN');
CREATE TYPE "SocialPublicationMethod" AS ENUM ('AUTOMATED','MANUAL','DRAFT_TRANSFER');

ALTER TABLE "SocialConnection"
  DROP CONSTRAINT IF EXISTS "SocialConnection_platform_key",
  ADD COLUMN "providerAccountId" TEXT,
  ADD COLUMN "providerUsername" TEXT,
  ADD COLUMN "profileImageUrl" TEXT,
  ADD COLUMN "encryptedTokenPayload" TEXT,
  ADD COLUMN "grantedScopes" JSONB,
  ADD COLUMN "supportedPostTypes" JSONB,
  ADD COLUMN "directPublishingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "directPublishingEnabledAt" TIMESTAMP(3),
  ADD COLUMN "directPublishingEnabledById" TEXT,
  ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lastAuthorizationCheckAt" TIMESTAMP(3),
  ADD COLUMN "lastSuccessfulPublicationAt" TIMESTAMP(3),
  ADD COLUMN "disconnectedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SocialConnection_platform_providerAccountId_key" ON "SocialConnection"("platform","providerAccountId");
CREATE INDEX "SocialConnection_platform_state_idx" ON "SocialConnection"("platform","state");
CREATE INDEX "SocialConnection_directPublishingEnabled_state_idx" ON "SocialConnection"("directPublishingEnabled","state");
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_directPublishingEnabledById_fkey" FOREIGN KEY ("directPublishingEnabledById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SocialConnectionAudit" (
  "id" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "actorId" TEXT, "action" TEXT NOT NULL,
  "sanitizedMetadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialConnectionAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SocialConnectionAudit_connectionId_createdAt_idx" ON "SocialConnectionAudit"("connectionId","createdAt");
CREATE INDEX "SocialConnectionAudit_actorId_createdAt_idx" ON "SocialConnectionAudit"("actorId","createdAt");
ALTER TABLE "SocialConnectionAudit" ADD CONSTRAINT "SocialConnectionAudit_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialConnectionAudit" ADD CONSTRAINT "SocialConnectionAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SocialPublishingSnapshot" (
  "id" TEXT NOT NULL, "variantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "contentVersion" INTEGER NOT NULL,
  "contentDigest" TEXT NOT NULL, "payload" JSONB NOT NULL, "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL, "scheduledAt" TIMESTAMP(3) NOT NULL, "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPublishingSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialPublishingSnapshot_variantId_connectionId_contentVersion_scheduledAt_key" ON "SocialPublishingSnapshot"("variantId","connectionId","contentVersion","scheduledAt");
CREATE INDEX "SocialPublishingSnapshot_variantId_invalidatedAt_idx" ON "SocialPublishingSnapshot"("variantId","invalidatedAt");
CREATE INDEX "SocialPublishingSnapshot_connectionId_createdAt_idx" ON "SocialPublishingSnapshot"("connectionId","createdAt");
ALTER TABLE "SocialPublishingSnapshot" ADD CONSTRAINT "SocialPublishingSnapshot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SocialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublishingSnapshot" ADD CONSTRAINT "SocialPublishingSnapshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublishingSnapshot" ADD CONSTRAINT "SocialPublishingSnapshot_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SocialPublishingJob" (
  "id" TEXT NOT NULL, "variantId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "snapshotId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "status" "SocialPublishingJobStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt" TIMESTAMP(3) NOT NULL, "nextAttemptAt" TIMESTAMP(3) NOT NULL, "claimedAt" TIMESTAMP(3),
  "claimToken" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "providerSubmissionId" TEXT, "externalPostId" TEXT, "publicUrl" TEXT,
  "lastErrorCategory" "SocialPublishingErrorCategory", "lastErrorMessage" TEXT,
  "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPublishingJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialPublishingJob_idempotencyKey_key" ON "SocialPublishingJob"("idempotencyKey");
CREATE INDEX "SocialPublishingJob_status_nextAttemptAt_idx" ON "SocialPublishingJob"("status","nextAttemptAt");
CREATE INDEX "SocialPublishingJob_variantId_createdAt_idx" ON "SocialPublishingJob"("variantId","createdAt");
CREATE INDEX "SocialPublishingJob_connectionId_status_idx" ON "SocialPublishingJob"("connectionId","status");
ALTER TABLE "SocialPublishingJob" ADD CONSTRAINT "SocialPublishingJob_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SocialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublishingJob" ADD CONSTRAINT "SocialPublishingJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublishingJob" ADD CONSTRAINT "SocialPublishingJob_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SocialPublishingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SocialPublishingAttempt" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "attemptNumber" INTEGER NOT NULL,
  "status" "SocialPublishingJobStatus" NOT NULL, "providerSubmissionId" TEXT, "externalPostId" TEXT,
  "publicUrl" TEXT, "errorCategory" "SocialPublishingErrorCategory", "sanitizedError" TEXT,
  "durationMs" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPublishingAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialPublishingAttempt_jobId_attemptNumber_key" ON "SocialPublishingAttempt"("jobId","attemptNumber");
CREATE INDEX "SocialPublishingAttempt_jobId_createdAt_idx" ON "SocialPublishingAttempt"("jobId","createdAt");
ALTER TABLE "SocialPublishingAttempt" ADD CONSTRAINT "SocialPublishingAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SocialPublishingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
