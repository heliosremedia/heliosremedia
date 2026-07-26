CREATE TYPE "MarketingEmailPreferenceStatus" AS ENUM (
  'SUBSCRIBED',
  'UNSUBSCRIBED',
  'SUPPRESSED',
  'PENDING_CONFIRMATION',
  'UNKNOWN'
);

ALTER TABLE "CommunicationGroup"
  ADD COLUMN "systemKey" TEXT,
  ADD COLUMN "systemManaged" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "CommunicationGroup_systemKey_key"
  ON "CommunicationGroup"("systemKey");

CREATE TABLE "MarketingEmailPreference" (
  "id" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "status" "MarketingEmailPreferenceStatus" NOT NULL DEFAULT 'UNKNOWN',
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL,
  "reason" TEXT,
  "messageId" TEXT,
  "campaignId" TEXT,
  "resubscribedAt" TIMESTAMP(3),
  "resubscribeMethod" TEXT,
  "actingAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingEmailPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingEmailPreferenceEvent" (
  "id" TEXT NOT NULL,
  "preferenceId" TEXT NOT NULL,
  "previousStatus" "MarketingEmailPreferenceStatus",
  "status" "MarketingEmailPreferenceStatus" NOT NULL,
  "source" TEXT NOT NULL,
  "reason" TEXT,
  "messageId" TEXT,
  "campaignId" TEXT,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingEmailPreferenceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingEmailPreferenceToken" (
  "id" TEXT NOT NULL,
  "preferenceId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "messageId" TEXT,
  "campaignId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingEmailPreferenceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingEmailPreference_normalizedEmail_key"
  ON "MarketingEmailPreference"("normalizedEmail");
CREATE INDEX "MarketingEmailPreference_status_effectiveAt_idx"
  ON "MarketingEmailPreference"("status", "effectiveAt");
CREATE INDEX "MarketingEmailPreferenceEvent_preferenceId_createdAt_idx"
  ON "MarketingEmailPreferenceEvent"("preferenceId", "createdAt");
CREATE INDEX "MarketingEmailPreferenceEvent_status_createdAt_idx"
  ON "MarketingEmailPreferenceEvent"("status", "createdAt");
CREATE UNIQUE INDEX "MarketingEmailPreferenceToken_tokenHash_key"
  ON "MarketingEmailPreferenceToken"("tokenHash");
CREATE INDEX "MarketingEmailPreferenceToken_preferenceId_expiresAt_idx"
  ON "MarketingEmailPreferenceToken"("preferenceId", "expiresAt");

ALTER TABLE "MarketingEmailPreference"
  ADD CONSTRAINT "MarketingEmailPreference_actingAdminId_fkey"
  FOREIGN KEY ("actingAdminId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingEmailPreferenceEvent"
  ADD CONSTRAINT "MarketingEmailPreferenceEvent_preferenceId_fkey"
  FOREIGN KEY ("preferenceId") REFERENCES "MarketingEmailPreference"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingEmailPreferenceEvent"
  ADD CONSTRAINT "MarketingEmailPreferenceEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingEmailPreferenceToken"
  ADD CONSTRAINT "MarketingEmailPreferenceToken_preferenceId_fkey"
  FOREIGN KEY ("preferenceId") REFERENCES "MarketingEmailPreference"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "MarketingEmailPreference" (
  "id", "normalizedEmail", "status", "effectiveAt", "source", "createdAt", "updatedAt"
)
SELECT
  'mep_' || md5("normalizedEmail"),
  "normalizedEmail",
  CASE
    WHEN bool_or(NOT "emailSubscribed") THEN 'UNSUBSCRIBED'::"MarketingEmailPreferenceStatus"
    ELSE 'UNKNOWN'::"MarketingEmailPreferenceStatus"
  END,
  COALESCE(max("unsubscribedAt"), CURRENT_TIMESTAMP),
  'V1.5.2_MIGRATION',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CommunicationClient"
WHERE "normalizedEmail" <> ''
GROUP BY "normalizedEmail"
ON CONFLICT ("normalizedEmail") DO NOTHING;

INSERT INTO "MarketingEmailPreferenceEvent" (
  "id", "preferenceId", "status", "source", "createdAt"
)
SELECT
  'mepe_' || md5("id"),
  "id",
  "status",
  'V1.5.2_MIGRATION',
  CURRENT_TIMESTAMP
FROM "MarketingEmailPreference";

INSERT INTO "CommunicationGroup" (
  "id", "name", "normalizedName", "systemKey", "systemManaged", "createdAt", "updatedAt"
)
VALUES (
  'system_marketing_unsubscribed',
  'Unsubscribed',
  'unsubscribed',
  'MARKETING_UNSUBSCRIBED',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("normalizedName") DO UPDATE SET
  "name" = EXCLUDED."name",
  "systemKey" = EXCLUDED."systemKey",
  "systemManaged" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CommunicationGroupMembership" ("id", "groupId", "clientId", "createdAt")
SELECT
  'ugm_' || md5(c."id"),
  g."id",
  c."id",
  CURRENT_TIMESTAMP
FROM "CommunicationClient" c
JOIN "MarketingEmailPreference" p ON p."normalizedEmail" = c."normalizedEmail"
JOIN "CommunicationGroup" g ON g."systemKey" = 'MARKETING_UNSUBSCRIBED'
WHERE p."status" IN ('UNSUBSCRIBED', 'SUPPRESSED')
ON CONFLICT ("groupId", "clientId") DO NOTHING;
