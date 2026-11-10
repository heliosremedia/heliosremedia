-- Existing invitations retain their responses and have no additional guests.
-- The count excludes the invited client. It is tentative for Maybe responses.
ALTER TABLE "EventInvitation"
ADD COLUMN "additionalGuests" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EventInvitation"
ADD CONSTRAINT "EventInvitation_additionalGuests_check"
CHECK ("additionalGuests" BETWEEN 0 AND 99 AND ("response" IN ('YES', 'MAYBE') OR "additionalGuests" = 0));
