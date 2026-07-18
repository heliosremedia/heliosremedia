CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'Helios Real Estate Media',
    "phoneDisplay" TEXT NOT NULL DEFAULT '970.682.5533',
    "phoneE164" TEXT NOT NULL DEFAULT '+19706825533',
    "email" TEXT,
    "bookingUrl" TEXT,
    "locationLabel" TEXT NOT NULL DEFAULT 'Fort Collins, Colorado',
    "serviceArea" TEXT NOT NULL DEFAULT 'Northern Colorado',
    "serviceAreaDescription" TEXT,
    "footerDescription" TEXT,
    "availabilityMessage" TEXT,
    "websiteUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "youtubeUrl" TEXT,
    "linkedinUrl" TEXT,
    "defaultSeoTitle" TEXT NOT NULL DEFAULT 'Helios Real Estate Media',
    "defaultSeoDescription" TEXT NOT NULL DEFAULT 'Luxury real estate photography, cinematic films, and branding for Northern Colorado''s finest homes.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SiteSettings" ("id", "serviceAreaDescription", "footerDescription", "createdAt", "updatedAt") VALUES
('default', 'Serving Fort Collins, Loveland, Windsor, Timnath, Greeley, Wellington, Berthoud, Boulder, and surrounding Northern Colorado communities.', 'Photography, cinematic film, aerial media, and marketing content created for real estate professionals across Northern Colorado.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
