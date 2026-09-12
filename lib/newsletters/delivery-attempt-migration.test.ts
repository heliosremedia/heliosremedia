import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../../prisma/migrations/20260912031500_newsletter_delivery_attempts/migration.sql", import.meta.url), "utf8");

test("delivery attempt migration enforces company, campaign, execution and immutable receipt identities", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "NewsletterSeries" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "NewsletterEdition" (id TEXT PRIMARY KEY, "seriesId" TEXT, "rowVersion" INTEGER, status TEXT);
      CREATE TABLE "EmailCampaign" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "NewsletterRevision" (id TEXT PRIMARY KEY, "editionId" TEXT);
      CREATE TABLE "NewsletterDelivery" ("editionId" TEXT PRIMARY KEY, "campaignId" TEXT, "revisionId" TEXT);
      CREATE TABLE "CampaignRecipient" (id TEXT PRIMARY KEY, "campaignId" TEXT);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "NewsletterSeries" VALUES ('series-a', 'a'), ('series-b', 'b');
      INSERT INTO "NewsletterEdition" VALUES ('edition-a', 'series-a', 5, 'SENDING'), ('edition-b', 'series-b', 5, 'SENDING');
      INSERT INTO "EmailCampaign" VALUES ('campaign-a', 'a'), ('campaign-b', 'b');
      INSERT INTO "NewsletterRevision" VALUES ('revision-a', 'edition-a'), ('revision-b', 'edition-b');
      INSERT INTO "NewsletterDelivery" VALUES ('edition-a', 'campaign-a', 'revision-a'), ('edition-b', 'campaign-b', 'revision-b');
      INSERT INTO "CampaignRecipient" VALUES ('recipient-a', 'campaign-a'), ('recipient-b', 'campaign-b');
    `);
    await db.exec(migration);
    const insert = (id: string, workspaceId = "a", version = 5, recipients = ["recipient-a"], batch = 0) => db.query(`
      INSERT INTO "NewsletterDeliveryAttempt" (id, "workspaceId", "editionId", "revisionId", "executionVersion", "batchNumber", "providerOperationId", "providerIdempotencyKey", "recipientIds", "payloadHash", "updatedAt")
      VALUES ($1, $2, 'edition-a', 'revision-a', $3, $4, 'operation', 'provider-key', $5, $6, NOW())
    `, [id, workspaceId, version, batch, JSON.stringify(recipients), "a".repeat(64)]);
    await assert.rejects(insert("foreign", "b"), /ownership or execution/);
    await assert.rejects(insert("stale", "a", 4), /ownership or execution/);
    await assert.rejects(insert("foreign-recipient", "a", 5, ["recipient-b"]), /another campaign/);
    await assert.rejects(insert("duplicate-recipient", "a", 5, ["recipient-a", "recipient-a"]), /identities are invalid/);
    await insert("attempt");
    await assert.rejects(insert("duplicate"), /unique constraint/);
    await assert.rejects(db.exec(`UPDATE "NewsletterDeliveryAttempt" SET "workspaceId" = 'b' WHERE id = 'attempt'`), /immutable/);
    await assert.rejects(db.exec(`UPDATE "NewsletterDeliveryAttempt" SET "payloadHash" = '${"b".repeat(64)}' WHERE id = 'attempt'`), /immutable/);
    await assert.rejects(db.exec(`UPDATE "NewsletterDeliveryAttempt" SET status = 'ACCEPTED', "providerReceiptIds" = '[]' WHERE id = 'attempt'`), /check constraint/);
    await db.exec(`UPDATE "NewsletterDeliveryAttempt" SET status = 'ACCEPTED', "providerReceiptIds" = '["receipt"]' WHERE id = 'attempt'`);
    await assert.rejects(db.exec(`UPDATE "NewsletterDeliveryAttempt" SET status = 'REJECTED' WHERE id = 'attempt'`), /explicit reconciliation/);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id = 'a'`), /foreign key constraint/);
    assert.equal((await db.query(`SELECT * FROM "NewsletterDelivery"`)).rows.length, 2);
  } finally { await db.close(); }
});
