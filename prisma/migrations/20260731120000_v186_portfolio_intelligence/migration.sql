-- V1.8.6 is additive. Analytics begin when this migration is deployed; no
-- historical events are fabricated.
CREATE TYPE "PortfolioAnalyticsEventName" AS ENUM (
  'PORTFOLIO_VIEW',
  'PROJECT_VIEW',
  'PORTFOLIO_CARD_CLICK',
  'PORTFOLIO_FILTER_USE',
  'GALLERY_IMAGE_OPEN',
  'VIDEO_START',
  'VIDEO_PROGRESS_25',
  'VIDEO_PROGRESS_50',
  'VIDEO_PROGRESS_75',
  'VIDEO_COMPLETE',
  'PROJECT_SHARE',
  'CTA_CLICK',
  'OUTBOUND_LINK_CLICK'
);

ALTER TABLE "AdminUser"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "legacyDisplayName" TEXT;

ALTER TABLE "AdminInvitation"
  ADD COLUMN "title" TEXT;

ALTER TABLE "ProjectContributor"
  ADD COLUMN "titleSnapshot" TEXT;

ALTER TABLE "Project" ADD COLUMN "workspaceId" TEXT;

UPDATE "Project"
SET "workspaceId" = (
  SELECT "workspaceId"
  FROM "SiteSettings"
  WHERE "workspaceId" IS NOT NULL
  ORDER BY "id"
  LIMIT 1
)
WHERE "workspaceId" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE INDEX "Project_workspaceId_status_idx" ON "Project"("workspaceId", "status");
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the original value before splitting only the unambiguous
-- "Display Name - Professional Title" shape. Existing titles are never
-- overwritten and ambiguous/multiple delimiters remain untouched.
UPDATE "AdminUser"
SET
  "legacyDisplayName" = "displayName",
  "displayName" = btrim(split_part("displayName", ' - ', 1)),
  "title" = btrim(split_part("displayName", ' - ', 2))
WHERE
  "title" IS NULL
  AND "displayName" LIKE '% - %'
  AND array_length(string_to_array("displayName", ' - '), 1) = 2
  AND btrim(split_part("displayName", ' - ', 1)) <> ''
  AND btrim(split_part("displayName", ' - ', 2)) <> '';

UPDATE "ProjectContributor" AS credit
SET "titleSnapshot" = user_record."title"
FROM "AdminUser" AS user_record
WHERE
  credit."adminUserId" = user_record."id"
  AND credit."titleSnapshot" IS NULL
  AND user_record."title" IS NOT NULL;

CREATE TABLE "PortfolioAnalyticsEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT,
  "eventName" "PortfolioAnalyticsEventName" NOT NULL,
  "eventKey" TEXT,
  "sessionId" TEXT NOT NULL,
  "deviceCategory" TEXT NOT NULL,
  "trafficSource" TEXT NOT NULL,
  "referrerHost" TEXT,
  "channel" TEXT,
  "target" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioAnalyticsEvent_eventKey_key"
  ON "PortfolioAnalyticsEvent"("eventKey");
CREATE INDEX "PortfolioAnalyticsEvent_workspaceId_occurredAt_idx"
  ON "PortfolioAnalyticsEvent"("workspaceId", "occurredAt");
CREATE INDEX "PortfolioAnalyticsEvent_workspaceId_eventName_occurredAt_idx"
  ON "PortfolioAnalyticsEvent"("workspaceId", "eventName", "occurredAt");
CREATE INDEX "PortfolioAnalyticsEvent_workspaceId_projectId_occurredAt_idx"
  ON "PortfolioAnalyticsEvent"("workspaceId", "projectId", "occurredAt");
CREATE INDEX "PortfolioAnalyticsEvent_projectId_eventName_occurredAt_idx"
  ON "PortfolioAnalyticsEvent"("projectId", "eventName", "occurredAt");
CREATE INDEX "PortfolioAnalyticsEvent_sessionId_occurredAt_idx"
  ON "PortfolioAnalyticsEvent"("sessionId", "occurredAt");

ALTER TABLE "PortfolioAnalyticsEvent"
  ADD CONSTRAINT "PortfolioAnalyticsEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioAnalyticsEvent"
  ADD CONSTRAINT "PortfolioAnalyticsEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
