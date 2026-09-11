-- Expand only. Historical ownership requires a verified backfill, not creator inference.
ALTER TABLE "NewsletterSeries" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "NewsletterSeries_workspaceId_idx" ON "NewsletterSeries"("workspaceId");
ALTER TABLE "NewsletterSeries" ADD CONSTRAINT "NewsletterSeries_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
