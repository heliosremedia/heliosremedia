ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'EXPIRING';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "SocialConnectionState" ADD VALUE IF NOT EXISTS 'REVOKED';

ALTER TABLE "SocialConnection"
  ADD COLUMN "parentProviderAccountId" TEXT,
  ADD COLUMN "lastConnectionTestAt" TIMESTAMP(3),
  ADD COLUMN "lastConnectionTestSuccessAt" TIMESTAMP(3),
  ADD COLUMN "lastPublishingAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastProviderErrorCode" TEXT,
  ADD COLUMN "lastProviderErrorMessage" TEXT;

UPDATE "SocialConnection"
SET "state" = 'REAUTHORIZATION_REQUIRED',
    "directPublishingEnabled" = false,
    "lastProviderErrorCode" = 'PLACEHOLDER_DESTINATION',
    "lastProviderErrorMessage" = 'Reconnect Meta and select an actual publishing destination.'
WHERE "providerAccountId" LIKE 'pending-%';

CREATE TABLE "SocialOAuthSession" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "safeReturnPath" TEXT NOT NULL,
  "encryptedTokenPayload" TEXT,
  "discoveredDestinations" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "authorizedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialOAuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialOAuthSession_stateHash_key" ON "SocialOAuthSession"("stateHash");
CREATE INDEX "SocialOAuthSession_workspaceId_provider_expiresAt_idx" ON "SocialOAuthSession"("workspaceId", "provider", "expiresAt");
CREATE INDEX "SocialOAuthSession_userId_expiresAt_idx" ON "SocialOAuthSession"("userId", "expiresAt");
ALTER TABLE "SocialOAuthSession" ADD CONSTRAINT "SocialOAuthSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialOAuthSession" ADD CONSTRAINT "SocialOAuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
