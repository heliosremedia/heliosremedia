-- Placements inherit CTA ownership. Preserve old writes and global slots.
ALTER TABLE "CallToAction" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "CallToAction_workspaceId_idx" ON "CallToAction"("workspaceId");
ALTER TABLE "CallToAction" ADD CONSTRAINT "CallToAction_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
