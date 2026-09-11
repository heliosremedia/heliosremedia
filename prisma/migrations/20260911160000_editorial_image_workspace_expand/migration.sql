ALTER TABLE "NewsletterImageAsset" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "NewsletterImageAsset_workspaceId_idx" ON "NewsletterImageAsset"("workspaceId");
ALTER TABLE "NewsletterImageAsset" ADD CONSTRAINT "NewsletterImageAsset_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Historical images remain unassigned until a verified per-record backfill.
