-- Do not infer historical campaign ownership from the creator's current account.
ALTER TABLE "EmailCampaign" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "EmailCampaign_workspaceId_idx" ON "EmailCampaign"("workspaceId");
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
