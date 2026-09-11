ALTER TABLE "ClientPortal" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "ClientPortal_workspaceId_active_displayOrder_idx" ON "ClientPortal"("workspaceId", "active", "displayOrder");
ALTER TABLE "ClientPortal" ADD CONSTRAINT "ClientPortal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
