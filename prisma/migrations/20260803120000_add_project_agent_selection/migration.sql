CREATE TABLE "CommunicationClientWorkspace" (
    "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "clientId" TEXT NOT NULL,
    "brokerage" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CommunicationClientWorkspace_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProjectAgent" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "clientId" TEXT,
    "displayNameSnapshot" TEXT NOT NULL, "brokerageSnapshot" TEXT, "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectAgent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunicationClientWorkspace_workspaceId_clientId_key" ON "CommunicationClientWorkspace"("workspaceId", "clientId");
CREATE INDEX "CommunicationClientWorkspace_workspaceId_brokerage_idx" ON "CommunicationClientWorkspace"("workspaceId", "brokerage");
CREATE INDEX "ProjectAgent_projectId_displayOrder_idx" ON "ProjectAgent"("projectId", "displayOrder");
CREATE INDEX "ProjectAgent_workspaceId_clientId_idx" ON "ProjectAgent"("workspaceId", "clientId");
ALTER TABLE "CommunicationClientWorkspace" ADD CONSTRAINT "CommunicationClientWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationClientWorkspace" ADD CONSTRAINT "CommunicationClientWorkspace_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAgent" ADD CONSTRAINT "ProjectAgent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAgent" ADD CONSTRAINT "ProjectAgent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectAgent" ADD CONSTRAINT "ProjectAgent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "CommunicationClientWorkspace" ("id", "workspaceId", "clientId", "createdAt", "updatedAt")
SELECT 'ccw_' || md5(w."id" || c."id"), w."id", c."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace" w CROSS JOIN "CommunicationClient" c
WHERE (SELECT COUNT(*) FROM "Workspace") = 1;
-- Legacy ProjectDetails credits remain untouched and are never auto-matched.
