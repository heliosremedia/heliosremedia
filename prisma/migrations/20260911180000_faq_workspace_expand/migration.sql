-- Additive ownership; preserve old writes and global slugs until verified mapping.
ALTER TABLE "FaqCategory" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "FaqCategory_workspaceId_idx" ON "FaqCategory"("workspaceId");
ALTER TABLE "FaqCategory" ADD CONSTRAINT "FaqCategory_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
