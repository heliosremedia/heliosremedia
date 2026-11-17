-- Additive private working-copy storage only. No public project/media fields are rewritten.
CREATE TABLE "ProjectCopyPackage" (
  "projectId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceDescription" TEXT NOT NULL,
  "copy" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectCopyPackage_pkey" PRIMARY KEY ("projectId"),
  CONSTRAINT "ProjectCopyPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectCopyPackage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProjectCopyPackage_workspaceId_idx" ON "ProjectCopyPackage"("workspaceId");
