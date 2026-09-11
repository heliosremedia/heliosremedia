-- Preserve all legacy/system groups; do not reassign unsubscribe or bounce groups.
ALTER TABLE "CommunicationGroup" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "CommunicationGroup_workspaceId_idx" ON "CommunicationGroup"("workspaceId");
ALTER TABLE "CommunicationGroup" ADD CONSTRAINT "CommunicationGroup_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Global name/system-key uniqueness is retained until all callers are converted.
