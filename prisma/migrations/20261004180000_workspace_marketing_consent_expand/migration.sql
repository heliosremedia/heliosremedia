-- Additive only: legacy consent, safety suppression and tokens remain intact.
BEGIN;
-- CreateEnum
CREATE TYPE "WorkspaceMarketingPreferenceStatus" AS ENUM ('UNKNOWN', 'SUBSCRIBED', 'UNSUBSCRIBED', 'PENDING_CONFIRMATION');

-- CreateTable
CREATE TABLE "WorkspaceMarketingPreference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "status" "WorkspaceMarketingPreferenceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMarketingPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMarketingPreferenceEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "preferenceId" TEXT NOT NULL,
    "previousStatus" "WorkspaceMarketingPreferenceStatus",
    "status" "WorkspaceMarketingPreferenceStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMarketingPreferenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMarketingPreferenceToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "preferenceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "messageId" TEXT,
    "campaignId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMarketingPreferenceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceMarketingPreference_workspaceId_status_effectiveAt_idx" ON "WorkspaceMarketingPreference"("workspaceId", "status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMarketingPreference_workspaceId_normalizedEmail_key" ON "WorkspaceMarketingPreference"("workspaceId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMarketingPreference_workspaceId_id_key" ON "WorkspaceMarketingPreference"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "WorkspaceMarketingPreferenceEvent_workspaceId_preferenceId__idx" ON "WorkspaceMarketingPreferenceEvent"("workspaceId", "preferenceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMarketingPreferenceToken_tokenHash_key" ON "WorkspaceMarketingPreferenceToken"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkspaceMarketingPreferenceToken_workspaceId_preferenceId__idx" ON "WorkspaceMarketingPreferenceToken"("workspaceId", "preferenceId", "expiresAt");

-- AddForeignKey
ALTER TABLE "WorkspaceMarketingPreference" ADD CONSTRAINT "WorkspaceMarketingPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkspaceMarketingPreferenceEvent" ADD CONSTRAINT "WorkspaceMarketingPreferenceEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkspaceMarketingPreferenceEvent" ADD CONSTRAINT "WorkspaceMarketingPreferenceEvent_workspaceId_preferenceId_fkey" FOREIGN KEY ("workspaceId", "preferenceId") REFERENCES "WorkspaceMarketingPreference"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkspaceMarketingPreferenceToken" ADD CONSTRAINT "WorkspaceMarketingPreferenceToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkspaceMarketingPreferenceToken" ADD CONSTRAINT "WorkspaceMarketingPreferenceToken_workspaceId_preferenceId_fkey" FOREIGN KEY ("workspaceId", "preferenceId") REFERENCES "WorkspaceMarketingPreference"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
