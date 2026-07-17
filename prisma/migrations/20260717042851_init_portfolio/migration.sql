-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaSourceType" AS ENUM ('UPLOADED_IMAGE', 'UPLOADED_VIDEO', 'VIDEO_EMBED', 'EXTERNAL_LINK', 'TOUR_EMBED');

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('PHOTOGRAPHY', 'DRONE_PHOTOGRAPHY', 'CINEMATIC_FILM', 'VERTICAL_REEL', 'AGENT_BRANDING', 'SOCIAL_CONTENT', 'FLOOR_PLAN', 'PROPERTY_WEBSITE', 'MATTERPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ExternalProvider" AS ENUM ('YOUTUBE', 'VIMEO', 'MATTERPORT', 'PROPERTY_WEBSITE', 'OTHER');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "city" TEXT,
    "state" TEXT,
    "locationLabel" TEXT,
    "projectType" TEXT,
    "propertyType" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "heroMediaId" TEXT,
    "thumbnailMediaId" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDetails" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "listingAgent" TEXT,
    "brokerage" TEXT,
    "builder" TEXT,
    "architect" TEXT,
    "interiorDesigner" TEXT,
    "price" DECIMAL(14,2),
    "squareFeet" INTEGER,
    "bedrooms" DOUBLE PRECISION,
    "bathrooms" DOUBLE PRECISION,
    "lotSize" TEXT,
    "neighborhood" TEXT,
    "propertyWebsiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" "MediaSourceType" NOT NULL,
    "mediaCategory" "MediaCategory" NOT NULL,
    "provider" "ExternalProvider",
    "storageKey" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "externalUrl" TEXT,
    "externalId" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "aspectRatio" DOUBLE PRECISION,
    "fileSize" INTEGER,
    "focalX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "focalY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectService" (
    "projectId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectService_pkey" PRIMARY KEY ("projectId","serviceId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTag" (
    "projectId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTag_pkey" PRIMARY KEY ("projectId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_heroMediaId_key" ON "Project"("heroMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_thumbnailMediaId_key" ON "Project"("thumbnailMediaId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_featured_idx" ON "Project"("featured");

-- CreateIndex
CREATE INDEX "Project_displayOrder_idx" ON "Project"("displayOrder");

-- CreateIndex
CREATE INDEX "Project_publishedAt_idx" ON "Project"("publishedAt");

-- CreateIndex
CREATE INDEX "Project_status_displayOrder_idx" ON "Project"("status", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDetails_projectId_key" ON "ProjectDetails"("projectId");

-- CreateIndex
CREATE INDEX "Media_projectId_idx" ON "Media"("projectId");

-- CreateIndex
CREATE INDEX "Media_projectId_displayOrder_idx" ON "Media"("projectId", "displayOrder");

-- CreateIndex
CREATE INDEX "Media_projectId_visibility_idx" ON "Media"("projectId", "visibility");

-- CreateIndex
CREATE INDEX "Media_mediaCategory_idx" ON "Media"("mediaCategory");

-- CreateIndex
CREATE INDEX "Media_sourceType_idx" ON "Media"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_active_displayOrder_idx" ON "Service"("active", "displayOrder");

-- CreateIndex
CREATE INDEX "ProjectService_serviceId_idx" ON "ProjectService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ProjectTag_tagId_idx" ON "ProjectTag"("tagId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_heroMediaId_fkey" FOREIGN KEY ("heroMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_thumbnailMediaId_fkey" FOREIGN KEY ("thumbnailMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDetails" ADD CONSTRAINT "ProjectDetails_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
