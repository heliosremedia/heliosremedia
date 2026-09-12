-- Additive: existing delivery rows and legacy writers remain unchanged.
CREATE TYPE "NewsletterDeliveryAttemptStatus" AS ENUM ('PREPARED', 'ACCEPTED', 'UNCERTAIN', 'REJECTED');
CREATE TABLE "NewsletterDeliveryAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "editionId" TEXT NOT NULL REFERENCES "NewsletterDelivery"("editionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "revisionId" TEXT NOT NULL,
  "executionVersion" INTEGER NOT NULL CHECK ("executionVersion" > 0),
  "batchNumber" INTEGER NOT NULL CHECK ("batchNumber" >= 0),
  "providerOperationId" TEXT NOT NULL,
  "providerIdempotencyKey" TEXT NOT NULL,
  "recipientIds" JSONB NOT NULL CHECK (jsonb_typeof("recipientIds") = 'array' AND jsonb_array_length("recipientIds") BETWEEN 1 AND 100),
  "payloadHash" TEXT NOT NULL CHECK ("payloadHash" ~ '^[a-f0-9]{64}$'),
  "status" "NewsletterDeliveryAttemptStatus" NOT NULL DEFAULT 'PREPARED',
  "providerReceiptIds" JSONB,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK ("status" <> 'ACCEPTED' OR ("providerReceiptIds" IS NOT NULL AND jsonb_typeof("providerReceiptIds") = 'array' AND jsonb_array_length("providerReceiptIds") = jsonb_array_length("recipientIds")))
);
CREATE UNIQUE INDEX "NewsletterDeliveryAttempt_execution_batch_key"
  ON "NewsletterDeliveryAttempt"("editionId", "executionVersion", "batchNumber");
CREATE INDEX "NewsletterDeliveryAttempt_workspaceId_status_createdAt_idx"
  ON "NewsletterDeliveryAttempt"("workspaceId", "status", "createdAt");

CREATE FUNCTION "guardNewsletterDeliveryAttempt"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW."recipientIds") value WHERE jsonb_typeof(value) <> 'string' OR value #>> '{}' = '')
    OR (SELECT COUNT(DISTINCT value) FROM jsonb_array_elements(NEW."recipientIds") value) <> jsonb_array_length(NEW."recipientIds") THEN
    RAISE EXCEPTION 'Newsletter attempt recipient identities are invalid';
  END IF;
  IF NEW."status" = 'ACCEPTED' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW."providerReceiptIds") value WHERE jsonb_typeof(value) <> 'string' OR value #>> '{}' = ''
  ) THEN RAISE EXCEPTION 'Newsletter attempt receipts are invalid'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW."id", NEW."workspaceId", NEW."editionId", NEW."revisionId", NEW."executionVersion", NEW."batchNumber", NEW."providerOperationId", NEW."providerIdempotencyKey", NEW."recipientIds", NEW."payloadHash", NEW."createdAt")
      IS DISTINCT FROM ROW(OLD."id", OLD."workspaceId", OLD."editionId", OLD."revisionId", OLD."executionVersion", OLD."batchNumber", OLD."providerOperationId", OLD."providerIdempotencyKey", OLD."recipientIds", OLD."payloadHash", OLD."createdAt") THEN
      RAISE EXCEPTION 'Newsletter attempt identity is immutable';
    END IF;
    IF OLD."status" <> 'PREPARED' AND ROW(NEW."status", NEW."providerReceiptIds", NEW."errorCode") IS DISTINCT FROM ROW(OLD."status", OLD."providerReceiptIds", OLD."errorCode") THEN
      RAISE EXCEPTION 'Newsletter attempt outcome requires explicit reconciliation';
    END IF;
  ELSE
    IF NEW."status" <> 'PREPARED' OR NEW."providerReceiptIds" IS NOT NULL THEN
      RAISE EXCEPTION 'Newsletter attempt must begin prepared';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "NewsletterDelivery" delivery
      JOIN "NewsletterEdition" edition ON edition.id = delivery."editionId"
      JOIN "NewsletterSeries" series ON series.id = edition."seriesId"
      JOIN "EmailCampaign" campaign ON campaign.id = delivery."campaignId"
      JOIN "NewsletterRevision" revision ON revision.id = delivery."revisionId" AND revision."editionId" = edition.id
      WHERE delivery."editionId" = NEW."editionId" AND delivery."revisionId" = NEW."revisionId"
        AND edition."rowVersion" = NEW."executionVersion" AND edition.status = 'SENDING'
        AND campaign."workspaceId" = NEW."workspaceId"
        AND (series."workspaceId" = NEW."workspaceId" OR (series."workspaceId" IS NULL AND (SELECT COUNT(*) FROM "Workspace") = 1))
    ) THEN RAISE EXCEPTION 'Newsletter attempt ownership or execution mismatch'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(NEW."recipientIds") recipient_id
      WHERE NOT EXISTS (
        SELECT 1 FROM "CampaignRecipient" recipient JOIN "NewsletterDelivery" delivery ON delivery."campaignId" = recipient."campaignId"
        WHERE delivery."editionId" = NEW."editionId" AND recipient.id = recipient_id
      )
    ) THEN RAISE EXCEPTION 'Newsletter attempt recipient belongs to another campaign'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "NewsletterDeliveryAttempt_identity_guard" BEFORE INSERT OR UPDATE ON "NewsletterDeliveryAttempt"
  FOR EACH ROW EXECUTE FUNCTION "guardNewsletterDeliveryAttempt"();
