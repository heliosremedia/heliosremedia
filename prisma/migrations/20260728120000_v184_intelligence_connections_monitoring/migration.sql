CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'ADVISORY', 'CRITICAL');
CREATE TYPE "OperationalIncidentState" AS ENUM ('OPEN', 'RECOVERED');

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
INSERT INTO "Workspace" ("id", "name", "slug", "updatedAt")
VALUES ('helios-default-workspace', 'Helios Real Estate Media', 'helios', CURRENT_TIMESTAMP);

ALTER TABLE "AdminUser" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "SocialCampaign" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "SocialStudioSettings" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "SocialConnection" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "Testimonial" ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "AdminUser" SET "workspaceId" = 'helios-default-workspace' WHERE "workspaceId" IS NULL;
UPDATE "SocialCampaign" SET "workspaceId" = 'helios-default-workspace' WHERE "workspaceId" IS NULL;
UPDATE "SocialStudioSettings" SET "workspaceId" = 'helios-default-workspace' WHERE "workspaceId" IS NULL;
UPDATE "SocialConnection" SET "workspaceId" = 'helios-default-workspace' WHERE "workspaceId" IS NULL;

ALTER TABLE "AdminUser" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "SocialCampaign" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "SocialStudioSettings" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "SocialConnection" ALTER COLUMN "workspaceId" SET NOT NULL;

DROP INDEX "SocialConnection_platform_providerAccountId_key";
DROP INDEX "SocialConnection_platform_state_idx";
CREATE UNIQUE INDEX "SocialConnection_workspaceId_platform_providerAccountId_key" ON "SocialConnection"("workspaceId", "platform", "providerAccountId");
CREATE INDEX "SocialConnection_workspaceId_platform_state_idx" ON "SocialConnection"("workspaceId", "platform", "state");
CREATE INDEX "SocialCampaign_workspaceId_updatedAt_idx" ON "SocialCampaign"("workspaceId", "updatedAt");
CREATE INDEX "AdminUser_workspaceId_idx" ON "AdminUser"("workspaceId");
CREATE UNIQUE INDEX "SocialStudioSettings_workspaceId_key" ON "SocialStudioSettings"("workspaceId");

ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialCampaign" ADD CONSTRAINT "SocialCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialStudioSettings" ADD CONSTRAINT "SocialStudioSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OperationalIncident" (
  "id" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "monitorName" TEXT,
  "monitorExternalId" TEXT,
  "state" "OperationalIncidentState" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "recoveredAt" TIMESTAMP(3),
  "responseTimeMs" INTEGER,
  "sanitizedSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalIncident_providerEventId_key" ON "OperationalIncident"("providerEventId");
CREATE INDEX "OperationalIncident_state_startedAt_idx" ON "OperationalIncident"("state", "startedAt");
