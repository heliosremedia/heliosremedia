-- Additive and initially empty. No operator enrollment or production activation.
CREATE TYPE "SupportAccessScope" AS ENUM ('DIAGNOSTICS');
CREATE TABLE "PlatformSupportOperator" (
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSupportOperator_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "SupportAccessGrant" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "reason" VARCHAR(600) NOT NULL,
  "scope" "SupportAccessScope" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportAccessGrant_workspaceId_createdAt_idx" ON "SupportAccessGrant"("workspaceId", "createdAt");
CREATE INDEX "SupportAccessGrant_operatorId_expiresAt_idx" ON "SupportAccessGrant"("operatorId", "expiresAt");
ALTER TABLE "PlatformSupportOperator" ADD CONSTRAINT "PlatformSupportOperator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "PlatformSupportOperator"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
