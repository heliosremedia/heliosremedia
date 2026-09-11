ALTER TABLE "Testimonial" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "TrustedLogo" ADD COLUMN "workspaceId" TEXT;

UPDATE "Testimonial" AS testimonial
SET "workspaceId" = review."workspaceId"
FROM "GoogleBusinessReview" AS review
WHERE review."testimonialId" = testimonial."id";

-- The release operator must verify legacy ownership and set this value on the
-- migration connection. Never infer ownership from creation order or branding.
DO $$
DECLARE
  legacy_workspace TEXT := NULLIF(current_setting('helios.legacy_brand_workspace_id', true), '');
BEGIN
  IF EXISTS (SELECT 1 FROM "Testimonial" WHERE "workspaceId" IS NULL)
    OR EXISTS (SELECT 1 FROM "TrustedLogo") THEN
    IF legacy_workspace IS NULL OR NOT EXISTS (
      SELECT 1 FROM "Workspace" WHERE "id" = legacy_workspace
    ) THEN
      RAISE EXCEPTION 'Verified legacy brand workspace mapping required: helios.legacy_brand_workspace_id';
    END IF;
    UPDATE "Testimonial" SET "workspaceId" = legacy_workspace WHERE "workspaceId" IS NULL;
    UPDATE "TrustedLogo" SET "workspaceId" = legacy_workspace;
  END IF;
END $$;

-- Expansion only: overlapping legacy writers may omit ownership.
-- Null rows stay excluded in tenant mode until explicitly reconciled.
-- NOT NULL belongs in a separately rehearsed contract release.

DROP INDEX IF EXISTS "Testimonial_published_displayOrder_idx";
DROP INDEX IF EXISTS "Testimonial_featured_idx";
DROP INDEX IF EXISTS "Testimonial_sourceProvider_published_displayOrder_idx";
-- Retain externalReviewId's legacy unique index until all legacy readers drain.
DROP INDEX IF EXISTS "TrustedLogo_published_displayOrder_idx";

CREATE INDEX "Testimonial_workspaceId_published_displayOrder_idx" ON "Testimonial"("workspaceId", "published", "displayOrder");
CREATE INDEX "Testimonial_workspaceId_featured_idx" ON "Testimonial"("workspaceId", "featured");
CREATE INDEX "Testimonial_workspaceId_sourceProvider_published_displayOrder_idx" ON "Testimonial"("workspaceId", "sourceProvider", "published", "displayOrder");
CREATE UNIQUE INDEX "Testimonial_workspaceId_externalReviewId_key" ON "Testimonial"("workspaceId", "externalReviewId");
CREATE INDEX "TrustedLogo_workspaceId_published_displayOrder_idx" ON "TrustedLogo"("workspaceId", "published", "displayOrder");

ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrustedLogo" ADD CONSTRAINT "TrustedLogo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
