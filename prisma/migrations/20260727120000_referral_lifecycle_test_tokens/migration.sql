ALTER TYPE "ReferralCampaignStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

CREATE TABLE "ReferralTestToken" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralTestToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralTestToken_tokenHash_key" ON "ReferralTestToken"("tokenHash");
CREATE INDEX "ReferralTestToken_campaignId_createdAt_idx" ON "ReferralTestToken"("campaignId", "createdAt");
CREATE INDEX "ReferralTestToken_createdById_createdAt_idx" ON "ReferralTestToken"("createdById", "createdAt");
CREATE INDEX "ReferralTestToken_expiresAt_idx" ON "ReferralTestToken"("expiresAt");
ALTER TABLE "ReferralTestToken" ADD CONSTRAINT "ReferralTestToken_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralTestToken" ADD CONSTRAINT "ReferralTestToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
