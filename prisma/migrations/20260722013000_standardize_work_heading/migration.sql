ALTER TABLE "SiteSettings"
  ADD COLUMN "workHeading" TEXT DEFAULT 'Crafted to Capture';

UPDATE "SiteSettings"
SET "workHeading" = NULLIF(TRIM(CONCAT_WS(' ', "workHeadingLineOne", "workHeadingLineTwo")), '')
WHERE "workHeading" IS NULL
   OR "workHeading" = 'Crafted to Capture';
