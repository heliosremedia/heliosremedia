CREATE TYPE "TeamDiscipline" AS ENUM (
  'PHOTOGRAPHER',
  'VIDEOGRAPHER',
  'DRONE_PILOT',
  'EDITOR',
  'CREATIVE_DIRECTOR',
  'OTHER'
);

CREATE TYPE "WorkspaceUserState" AS ENUM ('ACTIVE', 'DEACTIVATED');

ALTER TABLE "AdminUser"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "profilePhotoStorageKey" TEXT,
  ADD COLUMN "profilePhotoUrl" TEXT,
  ADD COLUMN "notificationPreferences" JSONB,
  ADD COLUMN "disciplines" "TeamDiscipline"[] NOT NULL DEFAULT ARRAY[]::"TeamDiscipline"[],
  ADD COLUMN "state" "WorkspaceUserState" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "AdminInvitation"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "disciplines" "TeamDiscipline"[] NOT NULL DEFAULT ARRAY[]::"TeamDiscipline"[],
  ADD COLUMN "workspaceId" TEXT;

UPDATE "AdminInvitation" invitation
SET "workspaceId" = creator."workspaceId"
FROM "AdminUser" creator
WHERE invitation."createdById" = creator."id";

ALTER TABLE "AdminInvitation" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "SiteSettings"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "bookingHandoffEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bookingProviderName" TEXT,
  ADD COLUMN "bookingEyebrow" TEXT,
  ADD COLUMN "bookingPrimaryLabel" TEXT,
  ADD COLUMN "bookingCallLabel" TEXT,
  ADD COLUMN "bookingEmailLabel" TEXT,
  ADD COLUMN "bookingPhoneVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bookingEmailVisible" BOOLEAN NOT NULL DEFAULT true;

UPDATE "SiteSettings"
SET "workspaceId" = (
  SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "workspaceId" IS NULL;

CREATE TABLE "ProjectContributor" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "adminUserId" TEXT,
  "workspaceId" TEXT NOT NULL,
  "displayNameSnapshot" TEXT NOT NULL,
  "disciplinesSnapshot" JSONB NOT NULL,
  "externalName" TEXT,
  "externalDiscipline" TEXT,
  "public" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectContributor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteSettings_workspaceId_key" ON "SiteSettings"("workspaceId");
CREATE INDEX "AdminInvitation_workspaceId_expiresAt_idx" ON "AdminInvitation"("workspaceId", "expiresAt");
CREATE UNIQUE INDEX "ProjectContributor_projectId_adminUserId_key" ON "ProjectContributor"("projectId", "adminUserId");
CREATE INDEX "ProjectContributor_projectId_displayOrder_idx" ON "ProjectContributor"("projectId", "displayOrder");
CREATE INDEX "ProjectContributor_workspaceId_adminUserId_idx" ON "ProjectContributor"("workspaceId", "adminUserId");

ALTER TABLE "AdminInvitation"
  ADD CONSTRAINT "AdminInvitation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteSettings"
  ADD CONSTRAINT "SiteSettings_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContributor"
  ADD CONSTRAINT "ProjectContributor_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContributor_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContributor_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
