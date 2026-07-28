ALTER TABLE "SiteSettings"
ADD COLUMN "defaultSocialImageStorageKey" TEXT,
ADD COLUMN "defaultSocialImageUrl" TEXT,
ADD COLUMN "defaultSocialImageAlt" TEXT,
ADD COLUMN "defaultSocialImageVersion" INTEGER NOT NULL DEFAULT 0;
