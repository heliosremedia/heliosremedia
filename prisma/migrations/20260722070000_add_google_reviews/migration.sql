ALTER TABLE "Testimonial"
ADD COLUMN "sourceProvider" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "externalReviewId" TEXT,
ADD COLUMN "reviewerPhotoUrl" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Testimonial_externalReviewId_key" ON "Testimonial"("externalReviewId");
CREATE INDEX "Testimonial_sourceProvider_published_displayOrder_idx" ON "Testimonial"("sourceProvider", "published", "displayOrder");
