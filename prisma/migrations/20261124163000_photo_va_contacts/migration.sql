CREATE TABLE "PhotoVaContact" (
    "workspaceId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotoVaContact_pkey" PRIMARY KEY ("workspaceId", "teamMemberId")
);

CREATE INDEX "PhotoVaContact_workspaceId_enabled_idx" ON "PhotoVaContact"("workspaceId", "enabled");
CREATE INDEX "PhotoVaContact_teamMemberId_idx" ON "PhotoVaContact"("teamMemberId");

ALTER TABLE "PhotoVaContact" ADD CONSTRAINT "PhotoVaContact_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoVaContact" ADD CONSTRAINT "PhotoVaContact_teamMemberId_fkey"
  FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
