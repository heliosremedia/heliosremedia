ALTER TABLE "ResendWebhookEvent"
  ADD COLUMN "normalizedStatus" TEXT,
  ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CampaignDeliveryEvent"
  ADD COLUMN "providerEventType" TEXT,
  ADD COLUMN "normalizedStatus" TEXT,
  ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processedAt" TIMESTAMP(3);

CREATE INDEX "CampaignRecipient_providerMessageId_idx"
  ON "CampaignRecipient"("providerMessageId");

