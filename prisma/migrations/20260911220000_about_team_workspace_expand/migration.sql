-- Preserve legacy content; ownership requires explicit verification.
ALTER TABLE "AboutPageContent" ADD COLUMN "workspaceId" TEXT;
CREATE UNIQUE INDEX "AboutPageContent_workspaceId_key" ON "AboutPageContent"("workspaceId");
CREATE INDEX "AboutPageContent_workspaceId_idx" ON "AboutPageContent"("workspaceId");
ALTER TABLE "AboutPageContent" ADD CONSTRAINT "AboutPageContent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "TeamMember_workspaceId_idx" ON "TeamMember"("workspaceId");
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
