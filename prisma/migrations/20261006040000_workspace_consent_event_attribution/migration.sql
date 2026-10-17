-- Preserve existing history as unattributed; provenance comes only from stored tokens.
ALTER TABLE "WorkspaceMarketingPreferenceEvent"
  ADD COLUMN "campaignId" TEXT,
  ADD COLUMN "messageId" TEXT;
CREATE INDEX "workspace_consent_campaign_status_idx"
  ON "WorkspaceMarketingPreferenceEvent"("workspaceId", "campaignId", "status");
