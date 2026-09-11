-- Expand only: old applications may still omit ownership during the overlap.
-- Do not infer historical ownership from branding, creator, or workspace age.
ALTER TABLE "BlogPost" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "BlogSeries" ADD COLUMN "workspaceId" TEXT;
CREATE INDEX "BlogPost_workspaceId_idx" ON "BlogPost"("workspaceId");
CREATE INDEX "BlogSeries_workspaceId_idx" ON "BlogSeries"("workspaceId");
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BlogSeries" ADD CONSTRAINT "BlogSeries_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Keep global slug uniqueness until all slug lookups use workspace ownership.
