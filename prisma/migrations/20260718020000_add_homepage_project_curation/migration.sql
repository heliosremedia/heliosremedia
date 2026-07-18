-- CreateTable
CREATE TABLE "HomepageProject" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "titleOverride" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomepageProject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomepageProject_projectId_key" ON "HomepageProject"("projectId");
CREATE INDEX "HomepageProject_active_displayOrder_idx" ON "HomepageProject"("active", "displayOrder");
ALTER TABLE "HomepageProject" ADD CONSTRAINT "HomepageProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
