CREATE TABLE "PhotoComparisonPage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL,
    "detailImageStorageKey" TEXT,
    "detailImageUrl" TEXT,
    "detailImageAlt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotoComparisonPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhotoComparisonPair" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "caption" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "standardImageStorageKey" TEXT,
    "standardImageUrl" TEXT NOT NULL,
    "editorialImageStorageKey" TEXT,
    "editorialImageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotoComparisonPair_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoComparisonPage_workspaceId_key" ON "PhotoComparisonPage"("workspaceId");
CREATE INDEX "PhotoComparisonPair_pageId_active_position_idx" ON "PhotoComparisonPair"("pageId", "active", "position");
ALTER TABLE "PhotoComparisonPage" ADD CONSTRAINT "PhotoComparisonPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoComparisonPair" ADD CONSTRAINT "PhotoComparisonPair_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PhotoComparisonPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
