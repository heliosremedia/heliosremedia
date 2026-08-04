ALTER TABLE "LocationPage"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "ctaHeadline" TEXT,
  ADD COLUMN "featureImageStorageKey" TEXT,
  ADD COLUMN "featureImageUrl" TEXT,
  ADD COLUMN "featureImageAlt" TEXT,
  ADD COLUMN "featureImageFocalX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "featureImageFocalY" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

UPDATE "LocationPage"
SET "workspaceId" = COALESCE(
  (SELECT "workspaceId" FROM "SiteSettings" WHERE "workspaceId" IS NOT NULL ORDER BY "updatedAt" DESC LIMIT 1),
  (SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "workspaceId" IS NULL;

ALTER TABLE "LocationPage" ALTER COLUMN "workspaceId" SET NOT NULL;
DROP INDEX IF EXISTS "LocationPage_slug_key";
DROP INDEX IF EXISTS "LocationPage_published_displayOrder_idx";
CREATE UNIQUE INDEX "LocationPage_workspaceId_slug_key" ON "LocationPage"("workspaceId", "slug");
CREATE INDEX "LocationPage_workspaceId_published_displayOrder_idx" ON "LocationPage"("workspaceId", "published", "displayOrder");
ALTER TABLE "LocationPage" ADD CONSTRAINT "LocationPage_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
