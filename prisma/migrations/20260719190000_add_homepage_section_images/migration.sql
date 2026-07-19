ALTER TABLE "SiteSettings"
ADD COLUMN "heliosStandardImageStorageKey" TEXT,
ADD COLUMN "heliosStandardImageUrl" TEXT,
ADD COLUMN "heliosStandardImageAlt" TEXT DEFAULT 'Luxury interior photographed by Helios Real Estate Media',
ADD COLUMN "primaryConversionImageStorageKey" TEXT,
ADD COLUMN "primaryConversionImageUrl" TEXT,
ADD COLUMN "primaryConversionImageAlt" TEXT DEFAULT 'Architectural living room photographed by Helios Real Estate Media';
