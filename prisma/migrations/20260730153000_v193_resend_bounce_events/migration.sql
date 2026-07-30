CREATE TABLE "ResendWebhookEvent" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientId" TEXT,
    "campaignRecipientId" TEXT,
    "normalizedEmail" TEXT,
    "bounceType" TEXT,
    "bounceSubtype" TEXT,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResendWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResendWebhookEvent_providerEventId_key" ON "ResendWebhookEvent"("providerEventId");
CREATE INDEX "ResendWebhookEvent_processingStatus_idx" ON "ResendWebhookEvent"("processingStatus");
CREATE INDEX "ResendWebhookEvent_workspaceId_idx" ON "ResendWebhookEvent"("workspaceId");
CREATE INDEX "ResendWebhookEvent_providerMessageId_idx" ON "ResendWebhookEvent"("providerMessageId");
CREATE INDEX "ResendWebhookEvent_clientId_idx" ON "ResendWebhookEvent"("clientId");

ALTER TABLE "ResendWebhookEvent" ADD CONSTRAINT "ResendWebhookEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResendWebhookEvent" ADD CONSTRAINT "ResendWebhookEvent_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResendWebhookEvent" ADD CONSTRAINT "ResendWebhookEvent_campaignRecipientId_fkey"
  FOREIGN KEY ("campaignRecipientId") REFERENCES "CampaignRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
