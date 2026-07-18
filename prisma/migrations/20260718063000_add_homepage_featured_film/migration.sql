ALTER TABLE "SiteSettings"
ADD COLUMN "featuredFilmEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featuredFilmVideoStorageKey" TEXT,
ADD COLUMN "featuredFilmVideoUrl" TEXT,
ADD COLUMN "featuredFilmPosterStorageKey" TEXT,
ADD COLUMN "featuredFilmPosterUrl" TEXT,
ADD COLUMN "featuredFilmDestination" TEXT DEFAULT '/portfolio?service=cinematic-films';
