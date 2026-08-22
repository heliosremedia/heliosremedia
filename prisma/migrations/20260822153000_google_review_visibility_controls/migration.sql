ALTER TABLE "SiteSettings"
ADD COLUMN "googleReviewDisplayMode" TEXT NOT NULL DEFAULT 'FOUR_AND_FIVE';

ALTER TABLE "GoogleBusinessReview"
ADD COLUMN "publicVisibilityOverride" BOOLEAN;
