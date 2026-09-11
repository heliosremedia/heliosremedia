ALTER TABLE "Inquiry" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "Inquiry_workspaceId_status_createdAt_idx" ON "Inquiry"("workspaceId", "status", "createdAt");
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
