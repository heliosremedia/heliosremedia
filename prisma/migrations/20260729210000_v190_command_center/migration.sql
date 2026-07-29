ALTER TABLE "AdminUser"
ADD COLUMN "dashboardPreferences" JSONB;

ALTER TABLE "Project"
ADD COLUMN "featuredStartedAt" TIMESTAMP(3),
ADD COLUMN "featuredExpiresAt" TIMESTAMP(3);

UPDATE "Project"
SET "featuredStartedAt" = COALESCE("publishedAt", "updatedAt")
WHERE "featured" = TRUE;

CREATE INDEX "Project_workspaceId_featured_featuredExpiresAt_idx"
ON "Project"("workspaceId", "featured", "featuredExpiresAt");
