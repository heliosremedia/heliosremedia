CREATE TABLE "ProjectPreviewLink" ("id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "label" TEXT, "createdById" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "lastUsedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProjectPreviewLink_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ProjectPreviewLink_tokenHash_key" ON "ProjectPreviewLink"("tokenHash");
CREATE INDEX "ProjectPreviewLink_projectId_createdAt_idx" ON "ProjectPreviewLink"("projectId", "createdAt");
CREATE INDEX "ProjectPreviewLink_expiresAt_idx" ON "ProjectPreviewLink"("expiresAt");
ALTER TABLE "ProjectPreviewLink" ADD CONSTRAINT "ProjectPreviewLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPreviewLink" ADD CONSTRAINT "ProjectPreviewLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
