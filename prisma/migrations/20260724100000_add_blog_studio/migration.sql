CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "SiteSettings"
ADD COLUMN "brandVoice" TEXT,
ADD COLUMN "brandAudience" TEXT,
ADD COLUMN "brandWritingGuidance" TEXT,
ADD COLUMN "defaultBlogAuthor" TEXT;

CREATE TABLE "BlogPost" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT NOT NULL,
  "author" TEXT,
  "category" TEXT,
  "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "featuredMediaId" TEXT,
  "featuredImageStorageKey" TEXT,
  "featuredImageUrl" TEXT,
  "featuredImageAlt" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "canonicalUrl" TEXT,
  "socialCaption" TEXT,
  "sourceLinks" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");
CREATE INDEX "BlogPost_category_idx" ON "BlogPost"("category");
CREATE INDEX "BlogPost_featuredMediaId_idx" ON "BlogPost"("featuredMediaId");

ALTER TABLE "BlogPost"
ADD CONSTRAINT "BlogPost_featuredMediaId_fkey"
FOREIGN KEY ("featuredMediaId") REFERENCES "Media"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
