CREATE TYPE "HomepageCardMediaMode" AS ENUM ('IMAGE', 'LIBRARY_VIDEO', 'UPLOADED_VIDEO');

CREATE TABLE "HomepageWorkCard" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "titleOverride" TEXT,
  "destinationOverride" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "imageStorageKey" TEXT,
  "imageUrl" TEXT,
  "imageAlt" TEXT,
  "mediaMode" "HomepageCardMediaMode" NOT NULL DEFAULT 'IMAGE',
  "featuredMediaId" TEXT,
  "videoStorageKey" TEXT,
  "videoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HomepageWorkCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomepageWorkCard_serviceId_key" ON "HomepageWorkCard"("serviceId");
CREATE INDEX "HomepageWorkCard_active_displayOrder_idx" ON "HomepageWorkCard"("active", "displayOrder");
CREATE INDEX "HomepageWorkCard_featuredMediaId_idx" ON "HomepageWorkCard"("featuredMediaId");

ALTER TABLE "HomepageWorkCard"
  ADD CONSTRAINT "HomepageWorkCard_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomepageWorkCard"
  ADD CONSTRAINT "HomepageWorkCard_featuredMediaId_fkey"
  FOREIGN KEY ("featuredMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "HomepageWorkCard" (
  "id", "serviceId", "titleOverride", "destinationOverride", "displayOrder",
  "imageUrl", "imageAlt", "mediaMode", "videoStorageKey", "videoUrl", "updatedAt"
)
SELECT
  'homepage-work-cinematic-films', "id", 'Cinematic Films', '/portfolio?service=cinematic-films', 0,
  COALESCE((SELECT "featuredFilmPosterUrl" FROM "SiteSettings" WHERE "id" = 'default'), '/work/cards/cinematicfilms-workcard.jpg'),
  'Cinematic films by Helios Real Estate Media',
  CASE WHEN COALESCE((SELECT "featuredFilmEnabled" FROM "SiteSettings" WHERE "id" = 'default'), false)
    AND (SELECT "featuredFilmVideoUrl" FROM "SiteSettings" WHERE "id" = 'default') IS NOT NULL
    THEN 'UPLOADED_VIDEO'::"HomepageCardMediaMode" ELSE 'IMAGE'::"HomepageCardMediaMode" END,
  (SELECT "featuredFilmVideoStorageKey" FROM "SiteSettings" WHERE "id" = 'default'),
  (SELECT "featuredFilmVideoUrl" FROM "SiteSettings" WHERE "id" = 'default'),
  CURRENT_TIMESTAMP
FROM "Service" WHERE "slug" = 'cinematic-films'
ON CONFLICT ("serviceId") DO NOTHING;

INSERT INTO "HomepageWorkCard" ("id", "serviceId", "titleOverride", "destinationOverride", "displayOrder", "imageUrl", "imageAlt", "updatedAt")
SELECT 'homepage-work-photography', "id", 'Photography', '/portfolio?service=photography', 1, '/work/cards/photography-workcard.jpg', 'Real estate photography by Helios Real Estate Media', CURRENT_TIMESTAMP
FROM "Service" WHERE "slug" = 'photography' ON CONFLICT ("serviceId") DO NOTHING;

INSERT INTO "HomepageWorkCard" ("id", "serviceId", "titleOverride", "destinationOverride", "displayOrder", "imageUrl", "imageAlt", "updatedAt")
SELECT 'homepage-work-agent-branding', "id", 'Agent Branding', '/portfolio?service=agent-branding', 2, '/work/cards/agent-branding-workcard.jpg', 'Agent branding by Helios Real Estate Media', CURRENT_TIMESTAMP
FROM "Service" WHERE "slug" = 'agent-branding' ON CONFLICT ("serviceId") DO NOTHING;

INSERT INTO "HomepageWorkCard" ("id", "serviceId", "titleOverride", "destinationOverride", "displayOrder", "imageUrl", "imageAlt", "updatedAt")
SELECT 'homepage-work-drone-photography', "id", 'Aerial & Drone', '/portfolio?service=drone-photography', 3, '/work/cards/aerial-drone-workcard.jpg', 'Aerial and drone photography by Helios Real Estate Media', CURRENT_TIMESTAMP
FROM "Service" WHERE "slug" = 'drone-photography' ON CONFLICT ("serviceId") DO NOTHING;

INSERT INTO "HomepageWorkCard" ("id", "serviceId", "titleOverride", "destinationOverride", "displayOrder", "imageUrl", "imageAlt", "updatedAt")
SELECT 'homepage-work-social-content', "id", 'Social Media', '/portfolio?service=social-content', 4, '/work/cards/socialmedia-workcard.jpg', 'Social media content by Helios Real Estate Media', CURRENT_TIMESTAMP
FROM "Service" WHERE "slug" = 'social-content' ON CONFLICT ("serviceId") DO NOTHING;
