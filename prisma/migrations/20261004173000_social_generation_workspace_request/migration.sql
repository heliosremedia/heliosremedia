-- Preserve existing request values and same-workspace uniqueness.
-- Build the narrower tenant constraint before removing the global constraint.
BEGIN;
CREATE UNIQUE INDEX "SocialCampaign_workspaceId_generationRequestId_key" ON "SocialCampaign"("workspaceId", "generationRequestId");
DROP INDEX "SocialCampaign_generationRequestId_key";
COMMIT;
