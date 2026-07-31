-- V1.9.4: make the workspace service catalog the stable identity for project media.
-- This migration is additive/backfilling until the final constraint swap and never deletes media.

ALTER TABLE "Service" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Service" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Existing installations have one public catalog. Assign it to the earliest
-- workspace, then clone the catalog for any additional workspaces so tenant
-- ownership is explicit without changing project relationships.
UPDATE "Service"
SET "workspaceId" = (SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "workspaceId" IS NULL;

DROP INDEX "Service_slug_key";
DROP INDEX "Service_active_displayOrder_idx";

INSERT INTO "Service" (
  "id", "name", "slug", "description", "heroImageStorageKey", "heroImageAlt",
  "displayOrder", "active", "createdAt", "updatedAt", "workspaceId", "archivedAt"
)
SELECT
  s."id" || ':' || w."id", s."name", s."slug", s."description",
  s."heroImageStorageKey", s."heroImageAlt", s."displayOrder", s."active",
  s."createdAt", s."updatedAt", w."id", NULL
FROM "Service" s
JOIN "Workspace" w ON w."id" <> s."workspaceId"
WHERE s."id" NOT LIKE '%:%'
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Service" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE UNIQUE INDEX "Service_workspaceId_slug_key" ON "Service"("workspaceId", "slug");
CREATE INDEX "Service_workspaceId_active_archivedAt_displayOrder_idx"
  ON "Service"("workspaceId", "active", "archivedAt", "displayOrder");
ALTER TABLE "Service" ADD CONSTRAINT "Service_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Repoint project-service rows at the matching catalog record for the
-- project's workspace. Existing rows are preserved through an insert/swap.
INSERT INTO "ProjectService" ("projectId", "serviceId", "createdAt")
SELECT ps."projectId", scoped."id", ps."createdAt"
FROM "ProjectService" ps
JOIN "Project" p ON p."id" = ps."projectId"
JOIN "Service" old ON old."id" = ps."serviceId"
JOIN "Service" scoped ON scoped."workspaceId" = p."workspaceId" AND scoped."slug" = old."slug"
ON CONFLICT ("projectId", "serviceId") DO NOTHING;

DELETE FROM "ProjectService" ps
USING "Project" p, "Service" s
WHERE ps."projectId" = p."id" AND ps."serviceId" = s."id" AND s."workspaceId" <> p."workspaceId";

ALTER TABLE "Media" ADD COLUMN "serviceId" TEXT;

UPDATE "Media" m
SET "serviceId" = s."id"
FROM "Project" p, "Service" s
WHERE p."id" = m."projectId"
  AND s."workspaceId" = p."workspaceId"
  AND s."slug" = CASE m."mediaCategory"::text
    WHEN 'PHOTOGRAPHY' THEN 'photography'
    WHEN 'DRONE_PHOTOGRAPHY' THEN 'drone-photography'
    WHEN 'CINEMATIC_FILM' THEN 'cinematic-films'
    WHEN 'VERTICAL_REEL' THEN 'vertical-reels'
    WHEN 'AGENT_BRANDING' THEN 'agent-branding'
    WHEN 'SOCIAL_CONTENT' THEN 'social-content'
    WHEN 'FLOOR_PLAN' THEN 'floor-plans'
    WHEN 'PROPERTY_WEBSITE' THEN 'property-websites'
    WHEN 'MATTERPORT' THEN 'matterport'
    ELSE 'photography'
  END;

-- A catalog may not contain a legacy category. Preserve those assets under the
-- first active workspace service instead of orphaning or deleting them.
UPDATE "Media" m
SET "serviceId" = (
  SELECT s."id" FROM "Service" s JOIN "Project" p ON p."workspaceId" = s."workspaceId"
  WHERE p."id" = m."projectId" AND s."archivedAt" IS NULL
  ORDER BY s."active" DESC, s."displayOrder" ASC, s."createdAt" ASC LIMIT 1
)
WHERE m."serviceId" IS NULL;

ALTER TABLE "Media" ALTER COLUMN "serviceId" SET NOT NULL;
CREATE INDEX "Media_serviceId_idx" ON "Media"("serviceId");
ALTER TABLE "Media" ADD CONSTRAINT "Media_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectMediaCollectionHero" ADD COLUMN "serviceId" TEXT;
UPDATE "ProjectMediaCollectionHero" h
SET "serviceId" = m."serviceId"
FROM "Media" m
WHERE m."id" = h."mediaId";
ALTER TABLE "ProjectMediaCollectionHero" ALTER COLUMN "serviceId" SET NOT NULL;
DELETE FROM "ProjectMediaCollectionHero" duplicate
USING "ProjectMediaCollectionHero" retained
WHERE duplicate."projectId" = retained."projectId"
  AND duplicate."serviceId" = retained."serviceId"
  AND duplicate."mediaId" > retained."mediaId";
ALTER TABLE "ProjectMediaCollectionHero" DROP CONSTRAINT "ProjectMediaCollectionHero_pkey";
ALTER TABLE "ProjectMediaCollectionHero" ADD CONSTRAINT "ProjectMediaCollectionHero_pkey" PRIMARY KEY ("projectId", "serviceId");
CREATE INDEX "ProjectMediaCollectionHero_serviceId_idx" ON "ProjectMediaCollectionHero"("serviceId");
ALTER TABLE "ProjectMediaCollectionHero" ADD CONSTRAINT "ProjectMediaCollectionHero_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
