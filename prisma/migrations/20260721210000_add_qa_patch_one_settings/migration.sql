ALTER TABLE "SiteSettings"
ADD COLUMN "standardHeading" TEXT DEFAULT 'Presentation Changes',
ADD COLUMN "standardHeadingAccent" TEXT DEFAULT 'Perception.',
ADD COLUMN "standardPrinciples" JSONB,
ADD COLUMN "approachHeading" TEXT DEFAULT 'We Build',
ADD COLUMN "approachHeadingAccent" TEXT DEFAULT 'Perceived Value.',
ADD COLUMN "approachCards" JSONB,
ADD COLUMN "approachTagline" TEXT DEFAULT 'Light. Clarity. Vision.',
ADD COLUMN "approachButtonLabel" TEXT DEFAULT 'Discover Helios',
ADD COLUMN "approachButtonDestination" TEXT DEFAULT '/about',
ADD COLUMN "headerNavigation" JSONB,
ADD COLUMN "footerNavigation" JSONB;
