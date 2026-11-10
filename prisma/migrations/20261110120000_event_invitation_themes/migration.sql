-- Existing events retain the classic invitation design; images are optional.
ALTER TABLE "EventInvitationEvent"
ADD COLUMN "templateKey" TEXT NOT NULL DEFAULT 'CLASSIC',
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "imageAlt" TEXT,
ADD COLUMN "venueUrl" TEXT,
ADD COLUMN "emailContent" JSONB;

ALTER TABLE "EventInvitationEvent"
ADD CONSTRAINT "EventInvitationEvent_templateKey_check"
CHECK ("templateKey" IN ('CLASSIC', 'CHRISTMAS', 'NEW_YEAR', 'THANKSGIVING', 'HALLOWEEN', 'EASTER', 'SUMMER', 'CELEBRATION'));

ALTER TABLE "EventInvitation"
ADD CONSTRAINT "EventInvitation_response_check"
CHECK ("response" IN ('PENDING', 'YES', 'NO', 'MAYBE'));
