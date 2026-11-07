CREATE TABLE "MonthlySummarySettings" (
  "workspaceId" TEXT NOT NULL PRIMARY KEY,
  "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "excludedOrderIds" JSONB NOT NULL DEFAULT '[]',
  "generationToken" TEXT,
  "generationUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlySummarySettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "MonthlyMediaSummary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "hdPhotoHubClientId" INTEGER NOT NULL,
  "reportingMonth" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "snapshot" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  CONSTRAINT "MonthlyMediaSummary_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MonthlyMediaSummary_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MonthlyMediaSummary_workspaceId_hdPhotoHubClientId_reportin_key" ON "MonthlyMediaSummary"("workspaceId", "hdPhotoHubClientId", "reportingMonth");
CREATE INDEX "MonthlyMediaSummary_workspaceId_reportingMonth_status_idx" ON "MonthlyMediaSummary"("workspaceId", "reportingMonth", "status");
CREATE TABLE "MonthlySummaryAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reportId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "kind" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SENDING',
  "providerMessageId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "MonthlySummaryAttempt_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MonthlyMediaSummary"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MonthlySummaryAttempt_requestKey_key" ON "MonthlySummaryAttempt"("requestKey");
CREATE UNIQUE INDEX "MonthlySummaryAttempt_providerMessageId_key" ON "MonthlySummaryAttempt"("providerMessageId");
CREATE INDEX "MonthlySummaryAttempt_reportId_createdAt_idx" ON "MonthlySummaryAttempt"("reportId", "createdAt");
