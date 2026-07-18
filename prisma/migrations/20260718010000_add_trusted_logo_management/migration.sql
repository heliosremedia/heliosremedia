-- CreateTable
CREATE TABLE "TrustedLogo" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "logoStorageKey" TEXT,
    "logoUrl" TEXT,
    "logoAlt" TEXT,
    "websiteUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedLogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustedLogo_published_displayOrder_idx" ON "TrustedLogo"("published", "displayOrder");

-- Preserve the nine partner logos already displayed on the homepage.
INSERT INTO "TrustedLogo" ("id", "organizationName", "logoUrl", "logoAlt", "displayOrder", "published", "createdAt", "updatedAt") VALUES
('trusted_logo_coldwell_banker', 'Coldwell Banker', '/trusted-by/trusted-by-logo-1.avif', 'Coldwell Banker', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('trusted_logo_better_homes', 'Better Homes and Gardens Real Estate', '/trusted-by/trusted-by-logo-2.avif', 'Better Homes and Gardens Real Estate', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('trusted_logo_bridgewater', 'Bridgewater Homes', '/trusted-by/trusted-by-logo-3.avif', 'Bridgewater Homes', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('trusted_logo_landmark', 'Landmark Homes', '/trusted-by/trusted-by-logo-4.avif', 'Landmark Homes', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('trusted_logo_toll_brothers', 'Toll Brothers', '/trusted-by/trusted-by-logo-5.avif', 'Toll Brothers', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('trusted_logo_windmill', 'Windmill Homes', '/trusted-by/trusted-by-logo-6.avif', 'Windmill Homes', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('trusted_logo_kentwood', 'Kentwood Real Estate', '/trusted-by/trusted-by-logo-7.avif', 'Kentwood Real Estate', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('trusted_logo_exp', 'eXp Realty Land and Ranch', '/trusted-by/trusted-by-logo-8.avif', 'eXp Realty Land and Ranch', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('trusted_logo_remax', 'RE/MAX', '/trusted-by/trusted-by-logo-9.avif', 'RE/MAX', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
