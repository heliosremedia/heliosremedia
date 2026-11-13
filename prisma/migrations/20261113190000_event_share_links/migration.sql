ALTER TABLE "EventInvitation" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'EMAIL';
CREATE TABLE "EventShareLink" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "encryptedToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventShareLink_eventId_key" ON "EventShareLink"("eventId");
CREATE UNIQUE INDEX "EventShareLink_tokenHash_key" ON "EventShareLink"("tokenHash");
ALTER TABLE "EventShareLink" ADD CONSTRAINT "EventShareLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventInvitationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
