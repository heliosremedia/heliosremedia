ALTER TABLE "ReferralCampaign" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "ReferralCampaign_workspaceId_status_createdAt_idx" ON "ReferralCampaign"("workspaceId", "status", "createdAt");
ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
