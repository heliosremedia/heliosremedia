CREATE TABLE "ProjectMediaCollectionHero" (
    "projectId" TEXT NOT NULL,
    "mediaCategory" "MediaCategory" NOT NULL,
    "mediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMediaCollectionHero_pkey" PRIMARY KEY ("projectId", "mediaCategory")
);

CREATE UNIQUE INDEX "ProjectMediaCollectionHero_mediaId_key"
ON "ProjectMediaCollectionHero"("mediaId");

CREATE INDEX "ProjectMediaCollectionHero_mediaCategory_idx"
ON "ProjectMediaCollectionHero"("mediaCategory");

ALTER TABLE "ProjectMediaCollectionHero"
ADD CONSTRAINT "ProjectMediaCollectionHero_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMediaCollectionHero"
ADD CONSTRAINT "ProjectMediaCollectionHero_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the existing project hero as the Photography collection hero when applicable.
INSERT INTO "ProjectMediaCollectionHero" ("projectId", "mediaCategory", "mediaId", "updatedAt")
SELECT p."id", m."mediaCategory", m."id", CURRENT_TIMESTAMP
FROM "Project" p
JOIN "Media" m ON m."id" = p."heroMediaId"
ON CONFLICT ("projectId", "mediaCategory") DO NOTHING;
