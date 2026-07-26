ALTER TYPE "BlogPostStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';

CREATE TYPE "BlogSeriesStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "BlogSeriesCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

CREATE TABLE "BlogSeries" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "targetAudience" TEXT NOT NULL,
  "cadence" "BlogSeriesCadence" NOT NULL DEFAULT 'BIWEEKLY',
  "generationHour" INTEGER NOT NULL DEFAULT 8,
  "leadDays" INTEGER NOT NULL DEFAULT 7,
  "nextGenerationAt" TIMESTAMP(3),
  "nextPublishAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'America/Denver',
  "contentPillars" JSONB NOT NULL,
  "brandVoice" TEXT NOT NULL,
  "prioritizeTopics" TEXT,
  "avoidTopics" TEXT,
  "targetLength" INTEGER NOT NULL DEFAULT 1000,
  "seoFocus" TEXT,
  "preferredCta" TEXT,
  "imagePreferences" TEXT,
  "status" "BlogSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastPillarIndex" INTEGER NOT NULL DEFAULT -1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlogSeries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BlogPost"
  ADD COLUMN "seriesId" TEXT,
  ADD COLUMN "intendedPublishAt" TIMESTAMP(3),
  ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "manualContent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "generationNotes" JSONB;

CREATE TABLE "BlogPostRevision" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "sourceLinks" JSONB,
  "changeSummary" TEXT NOT NULL,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlogPostRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlogSeries_status_nextGenerationAt_idx" ON "BlogSeries"("status", "nextGenerationAt");
CREATE INDEX "BlogPost_seriesId_intendedPublishAt_idx" ON "BlogPost"("seriesId", "intendedPublishAt");
CREATE INDEX "BlogPostRevision_postId_createdAt_idx" ON "BlogPostRevision"("postId", "createdAt");

ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "BlogSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlogPostRevision" ADD CONSTRAINT "BlogPostRevision_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
