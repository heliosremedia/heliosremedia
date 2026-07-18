-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "brokerage" TEXT,
    "testimonial" TEXT NOT NULL,
    "photoStorageKey" TEXT,
    "photoUrl" TEXT,
    "photoAlt" TEXT,
    "sourceUrl" TEXT,
    "focalX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "focalY" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Testimonial_published_displayOrder_idx" ON "Testimonial"("published", "displayOrder");
CREATE INDEX "Testimonial_featured_idx" ON "Testimonial"("featured");

-- Preserve the three testimonials already displayed on the homepage.
INSERT INTO "Testimonial" ("id", "agentName", "brokerage", "testimonial", "photoUrl", "photoAlt", "focalY", "rating", "displayOrder", "published", "featured", "createdAt", "updatedAt") VALUES
('testimonial_heather_washburn', 'Heather Washburn', 'RE/MAX Alliance', 'I switched from my previous photographer because I wanted something better. Jake’s work wasn’t just fast—it was absolutely gorgeous.', '/testimonials/testimonial-1.avif', 'Heather Washburn', 0.16, 5, 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('testimonial_stefanie_erion', 'Stefanie Erion', 'Kentwood Real Estate', 'Helios delivered incredible quality with an exceptional turnaround. My photos were back within twelve hours, and the results were beautiful.', '/testimonials/testimonial-2.avif', 'Stefanie Erion', 0.20, 5, 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('testimonial_liz_crews', 'Liz Crews', 'eXp Realty · Ranch & Land', 'Jake has the eye I’ve been looking for. I trust him to create a beautiful result every time, and he has become an integral part of my team.', '/testimonials/testimonial-3.avif', 'Liz Crews', 0.18, 5, 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
