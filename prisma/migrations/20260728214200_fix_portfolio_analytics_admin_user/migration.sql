-- Repair Portfolio Intelligence schema drift: Prisma expects the optional
-- AdminUser relation on PortfolioAnalyticsEvent, but the original V1.8.6
-- migration did not create the backing column or foreign key.

ALTER TABLE "PortfolioAnalyticsEvent"
  ADD COLUMN IF NOT EXISTS "adminUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PortfolioAnalyticsEvent_adminUserId_fkey'
  ) THEN
    ALTER TABLE "PortfolioAnalyticsEvent"
      ADD CONSTRAINT "PortfolioAnalyticsEvent_adminUserId_fkey"
      FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PortfolioAnalyticsEvent_adminUserId_idx"
  ON "PortfolioAnalyticsEvent"("adminUserId");
