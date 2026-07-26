CREATE TYPE "BookingMode" AS ENUM ('ONLINE', 'UNAVAILABLE', 'PAUSED');

ALTER TABLE "SiteSettings"
  ADD COLUMN "bookingMode" "BookingMode" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "bookingHeadline" TEXT DEFAULT 'Online booking is temporarily unavailable',
  ADD COLUMN "bookingExplanation" TEXT,
  ADD COLUMN "bookingEstimatedRestoreAt" TIMESTAMP(3),
  ADD COLUMN "bookingContactPhone" TEXT,
  ADD COLUMN "bookingContactEmail" TEXT,
  ADD COLUMN "bookingBannerMessage" TEXT,
  ADD COLUMN "bookingBannerEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bookingRequestEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CampaignDeliveryEvent" (
  "id" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "campaignRecipientId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "linkUrl" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignDeliveryEvent_providerEventId_key" ON "CampaignDeliveryEvent"("providerEventId");
CREATE INDEX "CampaignDeliveryEvent_campaignRecipientId_eventType_idx" ON "CampaignDeliveryEvent"("campaignRecipientId", "eventType");
CREATE INDEX "CampaignDeliveryEvent_providerMessageId_occurredAt_idx" ON "CampaignDeliveryEvent"("providerMessageId", "occurredAt");
ALTER TABLE "CampaignDeliveryEvent" ADD CONSTRAINT "CampaignDeliveryEvent_campaignRecipientId_fkey"
  FOREIGN KEY ("campaignRecipientId") REFERENCES "CampaignRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
