CREATE TYPE "GoogleBusinessConnectionStatus" AS ENUM ('NEEDS_LOCATION', 'CONNECTED', 'ERROR', 'REVOKED');
CREATE TYPE "GoogleReviewSyncStatus" AS ENUM ('CURRENT', 'ERROR');

CREATE TABLE "GoogleBusinessConnection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "status" "GoogleBusinessConnectionStatus" NOT NULL DEFAULT 'NEEDS_LOCATION',
  "refreshTokenCiphertext" TEXT NOT NULL,
  "accountResourceName" TEXT,
  "accountDisplayName" TEXT,
  "locationResourceName" TEXT,
  "locationTitle" TEXT,
  "locationAddress" TEXT,
  "availableLocations" JSONB,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncStatus" "GoogleReviewSyncStatus",
  "lastSyncError" TEXT,
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "connectedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleBusinessConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleBusinessOAuthState" (
  "id" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "codeVerifierCiphertext" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleBusinessOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleBusinessReview" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "googleReviewId" TEXT NOT NULL,
  "reviewerName" TEXT NOT NULL,
  "reviewerPhotoUrl" TEXT,
  "starRating" INTEGER NOT NULL,
  "reviewText" TEXT,
  "reviewCreatedAt" TIMESTAMP(3),
  "reviewUpdatedAt" TIMESTAMP(3),
  "businessReplyText" TEXT,
  "businessReplyUpdatedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "syncStatus" "GoogleReviewSyncStatus" NOT NULL DEFAULT 'CURRENT',
  "syncError" TEXT,
  "testimonialId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleBusinessReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleBusinessConnection_workspaceId_key" ON "GoogleBusinessConnection"("workspaceId");
CREATE INDEX "GoogleBusinessConnection_status_updatedAt_idx" ON "GoogleBusinessConnection"("status", "updatedAt");
CREATE UNIQUE INDEX "GoogleBusinessOAuthState_stateHash_key" ON "GoogleBusinessOAuthState"("stateHash");
CREATE INDEX "GoogleBusinessOAuthState_workspaceId_adminUserId_expiresAt_idx" ON "GoogleBusinessOAuthState"("workspaceId", "adminUserId", "expiresAt");
CREATE INDEX "GoogleBusinessOAuthState_expiresAt_idx" ON "GoogleBusinessOAuthState"("expiresAt");
CREATE UNIQUE INDEX "GoogleBusinessReview_testimonialId_key" ON "GoogleBusinessReview"("testimonialId");
CREATE UNIQUE INDEX "GoogleBusinessReview_connectionId_googleReviewId_key" ON "GoogleBusinessReview"("connectionId", "googleReviewId");
CREATE INDEX "GoogleBusinessReview_workspaceId_reviewUpdatedAt_idx" ON "GoogleBusinessReview"("workspaceId", "reviewUpdatedAt");
CREATE INDEX "GoogleBusinessReview_workspaceId_testimonialId_idx" ON "GoogleBusinessReview"("workspaceId", "testimonialId");

ALTER TABLE "GoogleBusinessConnection" ADD CONSTRAINT "GoogleBusinessConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleBusinessConnection" ADD CONSTRAINT "GoogleBusinessConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GoogleBusinessReview" ADD CONSTRAINT "GoogleBusinessReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleBusinessReview" ADD CONSTRAINT "GoogleBusinessReview_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleBusinessConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleBusinessReview" ADD CONSTRAINT "GoogleBusinessReview_testimonialId_fkey" FOREIGN KEY ("testimonialId") REFERENCES "Testimonial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
