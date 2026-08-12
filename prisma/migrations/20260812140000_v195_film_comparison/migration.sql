CREATE TYPE "VideoOfferingGroup" AS ENUM ('CINEMATIC_FILM', 'SOCIAL_MEDIA_REEL');

CREATE TABLE "VideoOffering" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "publicName" TEXT NOT NULL,
  "positioningStatement" TEXT NOT NULL,
  "publicDescription" TEXT NOT NULL,
  "offeringGroup" "VideoOfferingGroup" NOT NULL,
  "comparisonOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "priceLabel" TEXT,
  "runtimeGuidance" TEXT,
  "orientation" TEXT,
  "bestForDescription" TEXT,
  "featureDistinctions" JSONB,
  "bookingDestination" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoOffering_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VideoOffering_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "VideoComparisonPlacement" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "showOnComparison" BOOLEAN NOT NULL DEFAULT false,
  "featuredExample" BOOLEAN NOT NULL DEFAULT false,
  "comparisonOrder" INTEGER NOT NULL DEFAULT 0,
  "publicTitle" TEXT,
  "posterOverrideUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoComparisonPlacement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VideoComparisonPlacement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VideoComparisonPlacement_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VideoComparisonPlacement_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "VideoOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VideoOffering_workspaceId_publicName_key" ON "VideoOffering"("workspaceId", "publicName");
CREATE INDEX "VideoOffering_workspaceId_active_offeringGroup_comparisonOrder_idx" ON "VideoOffering"("workspaceId", "active", "offeringGroup", "comparisonOrder");
CREATE UNIQUE INDEX "VideoComparisonPlacement_mediaId_key" ON "VideoComparisonPlacement"("mediaId");
CREATE INDEX "VideoComparisonPlacement_workspaceId_showOnComparison_idx" ON "VideoComparisonPlacement"("workspaceId", "showOnComparison");
CREATE INDEX "VideoComparisonPlacement_offeringId_showOnComparison_comparisonOrder_idx" ON "VideoComparisonPlacement"("offeringId", "showOnComparison", "comparisonOrder");
CREATE UNIQUE INDEX "VideoComparisonPlacement_one_featured_per_offering" ON "VideoComparisonPlacement"("workspaceId", "offeringId") WHERE "featuredExample" = true;

INSERT INTO "VideoOffering" ("id", "workspaceId", "publicName", "positioningStatement", "publicDescription", "offeringGroup", "comparisonOrder", "active", "priceLabel", "runtimeGuidance", "orientation", "bestForDescription", "featureDistinctions", "bookingDestination")
VALUES
('helios-premier-lifestyle-film', 'helios-default-workspace', 'Premier Lifestyle Film', 'Flagship cinematic production', 'A fully developed cinematic story created for luxury, distinctive, or highly marketable properties. It combines intentional filming, lifestyle storytelling, premium color grading, immersive sound design, advanced editing, and a carefully structured narrative.', 'CINEMATIC_FILM', 300, true, '$1,499', 'Longer, intentionally paced presentation', 'Horizontal', 'Luxury, distinctive, or highly marketable properties that need a campaign centerpiece', '["Full-scale cinematic storytelling","Highest production and editing level","Lifestyle and emotional narrative","Agent participation where appropriate","Immersive sound design","Top-tier color grading","Greater filming and editorial development","Longer, intentionally paced presentation","Designed as the primary campaign film"]', '/inquire'),
('helios-signature-film', 'helios-default-workspace', 'Signature Film', 'Premium cinematic property film', 'A polished, emotionally driven property film with elevated cinematography, intentional pacing, refined editing, premium color grading, and detailed sound design. It presents the property with more depth and atmosphere than a standard showcase while remaining focused primarily on the home.', 'CINEMATIC_FILM', 200, true, '$595', 'Longer than a Showcase Film', 'Horizontal', 'Listings that benefit from deeper atmosphere and elevated cinematic presentation', '["Premium cinematic filming","Intentional pacing","Strong emotional tone","Elevated editing","Refined color grading","Detailed sound design","Typically longer than a Showcase Film","Primarily property-focused","Less production complexity than a Premier Lifestyle Film"]', '/inquire'),
('helios-showcase-film', 'helios-default-workspace', 'Showcase Film', 'Standard cinematic listing film', 'A clean, polished 60-second property film designed to showcase the home’s strongest features with professional movement, music, color, and efficient pacing.', 'CINEMATIC_FILM', 100, true, '$395', 'Approximately 60 seconds', 'Horizontal', 'Listings that need a polished, efficient property showcase', '["Approximately 60 seconds","Professional horizontal property film","Clean, efficient pacing","Music-driven edit","Professional color treatment","Focused on primary property features","Simpler production and narrative structure","Entry point into Helios cinematic films"]', '/inquire'),
('helios-premium-social-listing-reel', 'helios-default-workspace', 'Premium Social Listing Reel', 'Purpose-built vertical social production', 'A professionally filmed vertical listing reel created specifically for social media, with intentional vertical compositions, premium editing, drone footage where appropriate, stronger visual storytelling, and the option to feature the agent on camera.', 'SOCIAL_MEDIA_REEL', 200, true, NULL, NULL, 'Vertical', 'Agents who want original, purpose-built social storytelling', '["Filmed specifically for vertical presentation","Dedicated vertical compositions","Agent on-camera option","Premium captions where appropriate","Drone footage where appropriate","Deliberate story structure","Higher production and editing level","Original social content rather than a simple conversion"]', '/inquire'),
('helios-social-listing-reel', 'helios-default-workspace', 'Social Listing Reel', 'Standard vertical listing video', 'A concise vertical reel created primarily from the property’s existing horizontal video footage and formatted for social platforms.', 'SOCIAL_MEDIA_REEL', 100, true, NULL, NULL, 'Vertical', 'Fast listing promotion using an existing horizontal film', '["Vertical social format","Created primarily from existing horizontal footage","Fast, engaging pacing","Music-driven edit","Minimal additional production","Designed for quick listing promotion"]', '/inquire')
ON CONFLICT ("id") DO UPDATE SET
  "publicName" = EXCLUDED."publicName",
  "positioningStatement" = EXCLUDED."positioningStatement",
  "publicDescription" = EXCLUDED."publicDescription",
  "offeringGroup" = EXCLUDED."offeringGroup",
  "comparisonOrder" = EXCLUDED."comparisonOrder",
  "active" = EXCLUDED."active",
  "priceLabel" = EXCLUDED."priceLabel",
  "runtimeGuidance" = EXCLUDED."runtimeGuidance",
  "orientation" = EXCLUDED."orientation",
  "bestForDescription" = EXCLUDED."bestForDescription",
  "featureDistinctions" = EXCLUDED."featureDistinctions",
  "bookingDestination" = EXCLUDED."bookingDestination",
  "updatedAt" = CURRENT_TIMESTAMP;
