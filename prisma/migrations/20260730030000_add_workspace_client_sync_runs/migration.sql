CREATE TABLE "ClientSyncRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "providerLabel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "errorCategory" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientSyncRun_workspaceId_startedAt_idx"
  ON "ClientSyncRun"("workspaceId", "startedAt");

CREATE INDEX "ClientSyncRun_workspaceId_providerKey_startedAt_idx"
  ON "ClientSyncRun"("workspaceId", "providerKey", "startedAt");

ALTER TABLE "ClientSyncRun"
  ADD CONSTRAINT "ClientSyncRun_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
