CREATE TYPE "ClientPortalProvider" AS ENUM ('HDPHOTOHUB', 'EXTERNAL');
CREATE TYPE "ClientPortalChallengePurpose" AS ENUM ('LOGIN', 'REGISTER');

CREATE TABLE "ClientPortal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "provider" "ClientPortalProvider" NOT NULL DEFAULT 'HDPHOTOHUB',
    "hdphGroupId" INTEGER,
    "loginUrl" TEXT,
    "registrationUrl" TEXT,
    "bookingUrl" TEXT,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientPortal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPortalChallenge" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "purpose" "ClientPortalChallengePurpose" NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "requestFingerprint" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientPortalChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPortal_slug_key" ON "ClientPortal"("slug");
CREATE INDEX "ClientPortal_active_displayOrder_idx" ON "ClientPortal"("active", "displayOrder");
CREATE INDEX "ClientPortal_provider_idx" ON "ClientPortal"("provider");
CREATE UNIQUE INDEX "ClientPortalChallenge_tokenHash_key" ON "ClientPortalChallenge"("tokenHash");
CREATE INDEX "ClientPortalChallenge_portalId_email_idx" ON "ClientPortalChallenge"("portalId", "email");
CREATE INDEX "ClientPortalChallenge_requestFingerprint_createdAt_idx" ON "ClientPortalChallenge"("requestFingerprint", "createdAt");
CREATE INDEX "ClientPortalChallenge_expiresAt_idx" ON "ClientPortalChallenge"("expiresAt");
ALTER TABLE "ClientPortalChallenge" ADD CONSTRAINT "ClientPortalChallenge_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "ClientPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
