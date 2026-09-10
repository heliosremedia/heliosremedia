CREATE TYPE "WorkspaceMembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED');
CREATE TYPE "WorkspaceDomainPurpose" AS ENUM ('PUBLIC_SITE', 'ADMIN_ALIAS', 'TRACKING', 'EMAIL_LINK');
CREATE TYPE "WorkspaceDomainStatus" AS ENUM ('PENDING', 'VERIFYING', 'ACTIVE', 'FAILED', 'SUSPENDED');

CREATE TABLE "WorkspaceMembership" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
  "status" "WorkspaceMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceDomain" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "purpose" "WorkspaceDomainPurpose" NOT NULL DEFAULT 'PUBLIC_SITE',
  "status" "WorkspaceDomainStatus" NOT NULL DEFAULT 'PENDING',
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "verificationToken" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");
CREATE INDEX "WorkspaceMembership_userId_status_idx" ON "WorkspaceMembership"("userId", "status");
CREATE INDEX "WorkspaceMembership_workspaceId_status_role_idx" ON "WorkspaceMembership"("workspaceId", "status", "role");
CREATE UNIQUE INDEX "WorkspaceDomain_hostname_key" ON "WorkspaceDomain"("hostname");
CREATE INDEX "WorkspaceDomain_workspaceId_purpose_status_idx" ON "WorkspaceDomain"("workspaceId", "purpose", "status");
CREATE INDEX "WorkspaceDomain_workspaceId_primary_idx" ON "WorkspaceDomain"("workspaceId", "primary");
CREATE UNIQUE INDEX "WorkspaceDomain_one_primary_per_purpose_key" ON "WorkspaceDomain"("workspaceId", "purpose") WHERE "primary" = true;

ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceDomain" ADD CONSTRAINT "WorkspaceDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorkspaceMembership" ("id", "workspaceId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
  'wm_' || md5("workspaceId" || ':' || "id"),
  "workspaceId",
  "id",
  "role",
  CASE WHEN "active" = true THEN 'ACTIVE'::"WorkspaceMembershipStatus" ELSE 'SUSPENDED'::"WorkspaceMembershipStatus" END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AdminUser"
ON CONFLICT ("workspaceId", "userId") DO NOTHING;
