ALTER TABLE "Testimonial" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "TrustedLogo" ADD COLUMN "workspaceId" TEXT;

UPDATE "Testimonial" AS testimonial
SET "workspaceId" = review."workspaceId"
FROM "GoogleBusinessReview" AS review
WHERE review."testimonialId" = testimonial."id";

WITH legacy_workspace AS (
  SELECT COALESCE(
    (SELECT "workspaceId" FROM "SiteSettings" WHERE "id" = 'default' AND "workspaceId" IS NOT NULL LIMIT 1),
    (SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1)
  ) AS id
)
UPDATE "Testimonial"
SET "workspaceId" = legacy_workspace.id
FROM legacy_workspace
WHERE "Testimonial"."workspaceId" IS NULL;

WITH legacy_workspace AS (
  SELECT COALESCE(
    (SELECT "workspaceId" FROM "SiteSettings" WHERE "id" = 'default' AND "workspaceId" IS NOT NULL LIMIT 1),
    (SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1)
  ) AS id
)
UPDATE "TrustedLogo"
SET "workspaceId" = legacy_workspace.id
FROM legacy_workspace;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Testimonial" WHERE "workspaceId" IS NULL)
    OR EXISTS (SELECT 1 FROM "TrustedLogo" WHERE "workspaceId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign legacy testimonials and trusted logos without a workspace';
  END IF;
END $$;

ALTER TABLE "Testimonial" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "TrustedLogo" ALTER COLUMN "workspaceId" SET NOT NULL;

DROP INDEX IF EXISTS "Testimonial_published_displayOrder_idx";
DROP INDEX IF EXISTS "Testimonial_featured_idx";
DROP INDEX IF EXISTS "Testimonial_sourceProvider_published_displayOrder_idx";
DROP INDEX IF EXISTS "Testimonial_externalReviewId_key";
DROP INDEX IF EXISTS "TrustedLogo_published_displayOrder_idx";

CREATE INDEX "Testimonial_workspaceId_published_displayOrder_idx" ON "Testimonial"("workspaceId", "published", "displayOrder");
CREATE INDEX "Testimonial_workspaceId_featured_idx" ON "Testimonial"("workspaceId", "featured");
CREATE INDEX "Testimonial_workspaceId_sourceProvider_published_displayOrder_idx" ON "Testimonial"("workspaceId", "sourceProvider", "published", "displayOrder");
CREATE UNIQUE INDEX "Testimonial_workspaceId_externalReviewId_key" ON "Testimonial"("workspaceId", "externalReviewId");
CREATE INDEX "TrustedLogo_workspaceId_published_displayOrder_idx" ON "TrustedLogo"("workspaceId", "published", "displayOrder");

ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustedLogo" ADD CONSTRAINT "TrustedLogo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
