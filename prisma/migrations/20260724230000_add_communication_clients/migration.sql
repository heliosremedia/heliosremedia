CREATE TABLE "CommunicationClient" (
    "id" TEXT NOT NULL,
    "hdPhotoHubUserId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationClient_hdPhotoHubUserId_key" ON "CommunicationClient"("hdPhotoHubUserId");
CREATE INDEX "CommunicationClient_displayName_idx" ON "CommunicationClient"("displayName");
CREATE INDEX "CommunicationClient_normalizedEmail_idx" ON "CommunicationClient"("normalizedEmail");
CREATE INDEX "CommunicationClient_lastSyncedAt_idx" ON "CommunicationClient"("lastSyncedAt");
