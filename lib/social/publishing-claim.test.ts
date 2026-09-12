import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import type { PublishingClaim } from './publishing-claim';

test('publishing claim SQL fences company, revision and attempt, atomically preserving confirmed publication evidence', async () => {
  const db = new PGlite();
  let loseResponse = false;
  type Client = { query: (sql: string, values?: unknown[]) => Promise<unknown> };
  const exports: { commitPublishingClaim?: (claim: PublishingClaim, write: (tx: Client) => Promise<void>) => Promise<string> } = {};
  try {
    await db.exec(`
      CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "SocialConnection" (id TEXT PRIMARY KEY, "workspaceId" TEXT REFERENCES "Workspace", platform TEXT, "providerAccountId" TEXT, health TEXT);
      CREATE TABLE "SocialCampaign" (id TEXT PRIMARY KEY, "workspaceId" TEXT REFERENCES "Workspace");
      CREATE TABLE "SocialVariant" (id TEXT PRIMARY KEY, "campaignId" TEXT REFERENCES "SocialCampaign", "contentVersion" INT, status TEXT);
      CREATE TABLE "SocialPublishingSnapshot" (id TEXT PRIMARY KEY, "variantId" TEXT REFERENCES "SocialVariant", "connectionId" TEXT REFERENCES "SocialConnection", "contentVersion" INT, "invalidatedAt" TIMESTAMP);
      CREATE TABLE "SocialPublishingJob" (id TEXT PRIMARY KEY, "variantId" TEXT REFERENCES "SocialVariant", "connectionId" TEXT REFERENCES "SocialConnection", "snapshotId" TEXT REFERENCES "SocialPublishingSnapshot", "claimToken" TEXT, status TEXT, attempts INT);
      CREATE TABLE "SocialPublishingAttempt" (id TEXT PRIMARY KEY, "jobId" TEXT REFERENCES "SocialPublishingJob", status TEXT);
      CREATE TABLE "SocialPublication" (id TEXT PRIMARY KEY, "variantId" TEXT REFERENCES "SocialVariant", "connectionId" TEXT REFERENCES "SocialConnection");
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "SocialConnection" VALUES ('connection-a','a','FACEBOOK','account-a','OLD'), ('connection-b','b','FACEBOOK','account-b','OLD');
      INSERT INTO "SocialCampaign" VALUES ('campaign-a','a'), ('campaign-b','b');
      INSERT INTO "SocialVariant" VALUES ('variant-a','campaign-a',3,'SCHEDULED'), ('variant-b','campaign-b',3,'SCHEDULED');
      INSERT INTO "SocialPublishingSnapshot" VALUES ('snapshot-a','variant-a','connection-a',3,NULL), ('snapshot-b','variant-b','connection-b',3,NULL);
      INSERT INTO "SocialPublishingJob" VALUES ('job-a','variant-a','connection-a','snapshot-a','token-a','PUBLISHING',1), ('job-b','variant-b','connection-b','snapshot-b','token-b','PUBLISHING',1);
      INSERT INTO "SocialPublication" VALUES ('preserved-b','variant-b','connection-b');
    `);
    const modules: Record<string, unknown> = {
      'server-only': {}, '@/lib/prisma': { prisma: { $transaction: async (write: (tx: unknown) => Promise<unknown>) => {
        const result = await db.transaction(async sql => write({
          query: (query: string, values?: unknown[]) => sql.query(query, values),
          $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await sql.query(
            parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, ''), values,
          )).rows,
        }));
        if (loseResponse) throw new Error('Synthetic response loss after commit');
        return result;
      } } },
    };
    runInNewContext(ts.transpileModule(readFileSync(new URL('./publishing-claim.ts', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
    const claim: PublishingClaim = { workspaceId: 'a', jobId: 'job-a', claimToken: 'token-a', connectionId: 'connection-a',
      platform: 'FACEBOOK', providerAccountId: 'account-a', variantId: 'variant-a', snapshotId: 'snapshot-a', contentVersion: 3, attemptNumber: 1 };
    const snapshot = () => Promise.all(['SocialConnection', 'SocialVariant', 'SocialPublishingJob', 'SocialPublishingAttempt', 'SocialPublication']
      .map(table => db.query(`SELECT * FROM "${table}" ORDER BY id`).then(result => result.rows)));
    const before = await snapshot();
    for (const patch of [
      { workspaceId: 'b' }, { workspaceId: '' }, { jobId: 'job-b' }, { claimToken: 'old-token' },
      { connectionId: 'connection-b' }, { platform: 'INSTAGRAM' }, { providerAccountId: 'changed-account' },
      { variantId: 'variant-b' }, { snapshotId: 'snapshot-b' }, { contentVersion: 4 }, { attemptNumber: 2 },
    ]) {
      assert.equal(await exports.commitPublishingClaim!({ ...claim, ...patch }, async () => assert.fail('Invalid claim entered settlement')), 'CLAIM_CHANGED');
      assert.deepEqual(await snapshot(), before);
    }
    // Corruption of either relational parent must not become another company's write.
    for (const sql of [
      `UPDATE "SocialPublishingSnapshot" SET "connectionId"='connection-b' WHERE id='snapshot-a'`,
      `UPDATE "SocialPublishingSnapshot" SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE id='snapshot-a'`,
      `UPDATE "SocialVariant" SET "campaignId"='campaign-b' WHERE id='variant-a'`,
    ]) {
      await db.exec(sql);
      assert.equal(await exports.commitPublishingClaim!(claim, async () => assert.fail('Corrupt parent entered settlement')), 'CLAIM_CHANGED');
      await db.exec(`UPDATE "SocialPublishingSnapshot" SET "connectionId"='connection-a', "invalidatedAt"=NULL WHERE id='snapshot-a'; UPDATE "SocialVariant" SET "campaignId"='campaign-a' WHERE id='variant-a'`);
    }
    const write = async (tx: Client, fail: boolean) => {
      await tx.query(`UPDATE "SocialPublishingJob" SET status='PUBLISHED', "claimToken"=NULL WHERE id='job-a'`);
      await tx.query(`INSERT INTO "SocialPublishingAttempt" VALUES ('attempt-a','job-a','PUBLISHED')`);
      await tx.query(`UPDATE "SocialVariant" SET status='PUBLISHED' WHERE id='variant-a'`);
      await tx.query(`INSERT INTO "SocialPublication" VALUES ('publication-a','variant-a','connection-a')`);
      await tx.query(`UPDATE "SocialConnection" SET health='PUBLISHED' WHERE id='connection-a'`);
      if (fail) throw new Error('Synthetic failure after all writes');
    };
    assert.equal(await exports.commitPublishingClaim!(claim, tx => write(tx, true)), 'UNAVAILABLE');
    assert.deepEqual(await snapshot(), before);
    loseResponse = true;
    assert.equal(await exports.commitPublishingClaim!(claim, tx => write(tx, false)), 'UNAVAILABLE');
    const after = await snapshot();
    assert.notDeepEqual(after, before);
    for (const index of [0, 1, 2]) assert.deepEqual(after[index][1], before[index][1]);
    assert.deepEqual(after[4][0], before[4][0]);
    loseResponse = false;
    assert.equal(await exports.commitPublishingClaim!(claim, async () => assert.fail('Settled claim re-entered')), 'CLAIM_CHANGED');
    assert.deepEqual(await snapshot(), after);
  } finally { await db.close(); }
});
