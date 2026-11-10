-- Additional messages are independent deliveries. Existing stages, schedules and payloads remain unchanged.
ALTER TABLE "EventDelivery"
ADD COLUMN "updateSubject" TEXT,
ADD COLUMN "updateBody" TEXT,
ADD COLUMN "updateAudience" TEXT;
