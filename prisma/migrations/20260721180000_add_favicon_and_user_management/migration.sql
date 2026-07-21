ALTER TABLE "SiteSettings"
ADD COLUMN "faviconStorageKey" TEXT,
ADD COLUMN "faviconUrl" TEXT,
ADD COLUMN "faviconVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AdminUser"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AdminInvitation" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
  "tokenHash" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminInvitation_tokenHash_key" ON "AdminInvitation"("tokenHash");
CREATE INDEX "AdminInvitation_email_createdAt_idx" ON "AdminInvitation"("email", "createdAt");
CREATE INDEX "AdminInvitation_expiresAt_idx" ON "AdminInvitation"("expiresAt");
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
