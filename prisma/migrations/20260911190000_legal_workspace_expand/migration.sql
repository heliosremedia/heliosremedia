-- Preserve historical documents and old inserts. Type uniqueness is unchanged.
ALTER TABLE "LegalDocument" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "LegalDocument_workspaceId_idx" ON "LegalDocument"("workspaceId");
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
