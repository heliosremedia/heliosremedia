-- CreateTable
CREATE TABLE "EventInvitationEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timeZone" TEXT NOT NULL DEFAULT 'America/Denver',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mode" TEXT NOT NULL DEFAULT 'INDIVIDUALS',
    "clientIds" TEXT[],
    "groupIds" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventInvitationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDeliveryMessage" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "encryptedPayload" TEXT,
    "firstAttemptAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EventDeliveryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventInvitationEvent_workspaceId_createdAt_idx" ON "EventInvitationEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_tokenHash_key" ON "EventInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_eventId_clientId_key" ON "EventInvitation"("eventId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_eventId_email_key" ON "EventInvitation"("eventId", "email");

-- CreateIndex
CREATE INDEX "EventDelivery_status_scheduledAt_idx" ON "EventDelivery"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventDelivery_eventId_stage_key" ON "EventDelivery"("eventId", "stage");

-- CreateIndex
CREATE INDEX "EventDeliveryMessage_status_claimedAt_idx" ON "EventDeliveryMessage"("status", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventDeliveryMessage_deliveryId_invitationId_key" ON "EventDeliveryMessage"("deliveryId", "invitationId");

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventInvitationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDelivery" ADD CONSTRAINT "EventDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventInvitationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryMessage" ADD CONSTRAINT "EventDeliveryMessage_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EventDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryMessage" ADD CONSTRAINT "EventDeliveryMessage_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "EventInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE INDEX "EventDeliveryMessage_providerMessageId_idx" ON "EventDeliveryMessage"("providerMessageId");
