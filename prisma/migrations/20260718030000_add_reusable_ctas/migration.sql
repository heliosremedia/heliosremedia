CREATE TYPE "CtaActionType" AS ENUM ('BOOKING', 'PHONE', 'EMAIL', 'INTERNAL', 'EXTERNAL');
CREATE TYPE "CtaPlacementSlot" AS ENUM ('HOME_PRIMARY', 'ABOUT_FOOTER', 'SERVICES_FOOTER', 'FAQ_FOOTER', 'PORTFOLIO_FOOTER');

CREATE TABLE "CallToAction" (
  "id" TEXT NOT NULL,
  "internalName" TEXT NOT NULL,
  "eyebrow" TEXT,
  "headline" TEXT NOT NULL,
  "body" TEXT,
  "primaryLabel" TEXT NOT NULL,
  "primaryActionType" "CtaActionType" NOT NULL,
  "primaryValue" TEXT,
  "secondaryLabel" TEXT,
  "secondaryActionType" "CtaActionType",
  "secondaryValue" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallToAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CtaPlacement" (
  "id" TEXT NOT NULL,
  "slot" "CtaPlacementSlot" NOT NULL,
  "ctaId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CtaPlacement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CallToAction_published_idx" ON "CallToAction"("published");
CREATE UNIQUE INDEX "CtaPlacement_slot_key" ON "CtaPlacement"("slot");
CREATE INDEX "CtaPlacement_ctaId_idx" ON "CtaPlacement"("ctaId");
ALTER TABLE "CtaPlacement" ADD CONSTRAINT "CtaPlacement_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "CallToAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CallToAction" ("id", "internalName", "headline", "body", "primaryLabel", "primaryActionType", "secondaryLabel", "secondaryActionType", "secondaryValue", "published", "updatedAt")
VALUES ('cta_home_primary', 'Homepage primary conversion', 'The showing begins before the front door opens.', 'Professional photography and cinematic storytelling that shape first impressions long before buyers step inside.', 'Book Your Shoot', 'BOOKING', 'Explore Services', 'INTERNAL', '/services', true, CURRENT_TIMESTAMP);

INSERT INTO "CtaPlacement" ("id", "slot", "ctaId", "updatedAt")
VALUES ('cta_placement_home_primary', 'HOME_PRIMARY', 'cta_home_primary', CURRENT_TIMESTAMP);
