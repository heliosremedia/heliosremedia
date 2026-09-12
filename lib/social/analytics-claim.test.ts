import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

test('analytics claim locks fence company/account identity and roll back all metric and completion writes together', async () => {
  const db = new PGlite();
  let loseResponse = false;
  try {
    await db.exec(`
      CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "SocialConnection" (id TEXT PRIMARY KEY, "workspaceId" TEXT REFERENCES "Workspace", platform TEXT, "providerAccountId" TEXT, health TEXT);
      CREATE TABLE "SocialAnalyticsJob" (id TEXT PRIMARY KEY, "connectionId" TEXT REFERENCES "SocialConnection", "claimToken" TEXT, status TEXT);
      CREATE TABLE "SyntheticMetric" (id TEXT PRIMARY KEY, "connectionId" TEXT REFERENCES "SocialConnection", value INT);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "SocialConnection" VALUES ('connection-a','a','FACEBOOK','account-a','OLD'), ('connection-b','b','FACEBOOK','account-b','OLD');
      INSERT INTO "SocialAnalyticsJob" VALUES ('job-a','connection-a','token-a','RUNNING'), ('job-b','connection-b','token-b','RUNNING');
      INSERT INTO "SyntheticMetric" VALUES ('preserved-b','connection-b',9);
    `);
    type Claim = { jobId: string; claimToken: string; connectionId: string; workspaceId: string; platform: string; providerAccountId: string | null };
    type Client = { query: (sql: string, values?: unknown[]) => Promise<unknown> };
    const exports: { commitAnalyticsClaim?: (claim: Claim, write: (tx: Client) => Promise<void>) => Promise<string> } = {};
    const modules: Record<string, unknown> = {
      'server-only': {}, '@/lib/prisma': { prisma: { $transaction: async (write: (tx: unknown) => Promise<unknown>) => {
        const result = await db.transaction(async sql => write({
          query: (query: string, values?: unknown[]) => sql.query(query, values),
          $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await sql.query(parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, ''), values)).rows,
        }));
        if (loseResponse) throw new Error('Synthetic acknowledgement loss after commit');
        return result;
      } } },
    };
    runInNewContext(ts.transpileModule(readFileSync(new URL('./analytics-claim.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
    });
    const claim: Claim = { jobId: 'job-a', claimToken: 'token-a', connectionId: 'connection-a', workspaceId: 'a', platform: 'FACEBOOK', providerAccountId: 'account-a' };
    const snapshot = async () => Promise.all(['SocialConnection', 'SocialAnalyticsJob', 'SyntheticMetric'].map(table => db.query(`SELECT * FROM "${table}" ORDER BY id`).then(result => result.rows)));
    const before = await snapshot();
    for (const patch of [
      { workspaceId: 'b' }, { workspaceId: '' }, { claimToken: 'old-token' }, { jobId: 'job-b' },
      { connectionId: 'connection-b' }, { platform: 'INSTAGRAM' }, { providerAccountId: 'changed-account' }, { providerAccountId: null },
    ]) {
      const result = await exports.commitAnalyticsClaim!({ ...claim, ...patch }, async () => { assert.fail('foreign or stale claim entered persistence'); });
      assert.equal(result, 'CLAIM_CHANGED'); assert.deepEqual(await snapshot(), before);
    }
    let calls = 0;
    const write = async (tx: Client, fail: boolean) => {
      calls++;
      await tx.query(`INSERT INTO "SyntheticMetric" VALUES ('metric-a','connection-a',7)`);
      await tx.query(`UPDATE "SocialAnalyticsJob" SET status = 'SUCCEEDED', "claimToken" = NULL WHERE id = 'job-a'`);
      await tx.query(`UPDATE "SocialConnection" SET health = 'AVAILABLE' WHERE id = 'connection-a'`);
      if (fail) throw new Error('Synthetic failure after metric, job and connection writes');
    };
    assert.equal(await exports.commitAnalyticsClaim!(claim, tx => write(tx, true)), 'UNAVAILABLE');
    assert.equal(calls, 1); assert.deepEqual(await snapshot(), before);
    loseResponse = true;
    assert.equal(await exports.commitAnalyticsClaim!(claim, tx => write(tx, false)), 'UNAVAILABLE');
    assert.equal(calls, 2);
    const after = await snapshot();
    assert.notDeepEqual(after, before);
    assert.deepEqual(after[0][1], before[0][1]); assert.deepEqual(after[1][1], before[1][1]);
    assert.deepEqual(after[2][1], before[2][0]);
    loseResponse = false;
    assert.equal(await exports.commitAnalyticsClaim!(claim, async () => { assert.fail('settled token entered persistence'); }), 'CLAIM_CHANGED');
    assert.deepEqual(await snapshot(), after);
  } finally { await db.close(); }
});
