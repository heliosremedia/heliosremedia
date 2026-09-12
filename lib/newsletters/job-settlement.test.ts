import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}
type Result = { success: boolean; execution: string; settlement: string };
type Job = { id: string; type: 'SEND'; claimToken: string; editionId: string; attempts: number };
type Settlement = { settleNewsletterJob: (job: Job, execution: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'DEFERRED', error?: unknown) => Promise<Result> };
const job: Job = { id: 'job-a', type: 'SEND', claimToken: 'token-a', editionId: 'edition-a', attempts: 1 };

test('terminal write errors cannot reclassify execution, expose private errors or cause a fallback write', async () => {
  for (const execution of ['SUCCEEDED', 'FAILED', 'SKIPPED', 'DEFERRED'] as const) {
    for (const mode of ['confirmed', 'changed', 'unavailable', 'committed-response-lost'] as const) {
      const calls: string[] = [];
      let stored: string | null = null;
      const failure = new Error('synthetic execution failure');
      const write = async (kind: string, supplied: Job, error?: unknown) => {
        calls.push(kind); assert.equal(supplied, job);
        if (kind === 'FAILED') assert.equal(error, failure);
        if (mode === 'committed-response-lost' || mode === 'confirmed') stored = kind;
        if (mode === 'unavailable' || mode === 'committed-response-lost') throw new Error('private database details');
        return mode === 'confirmed';
      };
      const api = load<Settlement>('./job-settlement.ts', {
        'server-only': {}, './scheduler': {
          completeNewsletterJob: (supplied: Job) => write('COMPLETED', supplied),
          failNewsletterJob: (supplied: Job, error: unknown) => write('FAILED', supplied, error),
          deferUnstartedNewsletterJob: (supplied: Job) => write('DEFERRED', supplied),
        },
      });
      const result = await api.settleNewsletterJob(job, execution, failure);
      const kind = execution === 'DEFERRED' ? 'DEFERRED' : execution === 'FAILED' ? 'FAILED' : 'COMPLETED';
      assert.deepEqual(calls, [kind]); assert.equal(result.execution, execution);
      assert.equal(result.settlement, mode === 'confirmed' ? kind : mode === 'changed' ? 'CLAIM_CHANGED' : 'UNAVAILABLE');
      assert.equal(result.success, mode === 'confirmed' && ['SUCCEEDED', 'SKIPPED'].includes(execution));
      assert.equal(stored, mode === 'confirmed' || mode === 'committed-response-lost' ? kind : null);
      assert.equal(JSON.stringify(result).includes('private'), false);
      assert.equal(JSON.stringify(result).includes('token-a'), false);
    }
  }
});

test('actual settlement predicates preserve newer claims and settled records across companies', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "NewsletterJob" (id TEXT PRIMARY KEY, "workspaceId" TEXT, status TEXT, "claimToken" TEXT, "claimedAt" TIMESTAMPTZ, "leaseExpiresAt" TIMESTAMPTZ, "completedAt" TIMESTAMPTZ, "lastErrorCode" TEXT, "lastErrorMessage" TEXT);
      INSERT INTO "NewsletterJob" (id,"workspaceId",status,"claimToken") VALUES
        ('job-a','a','CLAIMED','token-a'), ('job-b','b','CLAIMED','token-b'),
        ('new-claim','a','CLAIMED','new-token'), ('recovered','a','FAILED',NULL), ('completed','a','COMPLETED','old-token');
    `);
    type Values = Record<string, unknown>;
    const scheduler = load<Record<string, unknown>>('./scheduler.ts', {
      'server-only': {}, 'node:crypto': {}, './recurrence': {}, './ownership': {}, '@/lib/blog-ownership': {},
      '@/lib/prisma': { prisma: { newsletterJob: { updateMany: async ({ where, data }: { where: Values; data: Values }) => {
        assert.deepEqual(Object.keys(where).sort(), ['claimToken', 'id', 'status']);
        assert.equal(where.status, 'CLAIMED');
        const values: unknown[] = [];
        const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
        const assignments = Object.entries(data).map(([key, value]) => `"${key}" = ${bind(value)}`).join(',');
        const predicates = Object.entries(where).map(([key, value]) => `"${key}" = ${bind(value)}`).join(' AND ');
        return { count: (await db.query(`UPDATE "NewsletterJob" SET ${assignments} WHERE ${predicates}`, values)).affectedRows };
      } } } },
    });
    const api = load<Settlement>('./job-settlement.ts', { 'server-only': {}, './scheduler': scheduler });
    const snapshot = async () => (await db.query(`SELECT * FROM "NewsletterJob" ORDER BY id`)).rows;
    const before = await snapshot();
    for (const id of ['job-b', 'new-claim', 'recovered', 'completed', 'missing']) {
      for (const execution of ['SUCCEEDED', 'FAILED', 'DEFERRED'] as const) {
        const result = await api.settleNewsletterJob({ ...job, id }, execution, new Error('failure'));
        assert.equal(result.settlement, 'CLAIM_CHANGED'); assert.equal(result.success, false);
      }
    }
    assert.deepEqual(await snapshot(), before);
    assert.equal((await api.settleNewsletterJob(job, 'DEFERRED')).settlement, 'DEFERRED');
    const pending = (await db.query<{ status: string; claimToken: string | null }>(`SELECT status, "claimToken" FROM "NewsletterJob" WHERE id = 'job-a'`)).rows[0];
    assert.equal(pending.status, 'PENDING'); assert.equal(pending.claimToken, null);
    assert.equal((await api.settleNewsletterJob(job, 'SUCCEEDED')).settlement, 'CLAIM_CHANGED');
    await db.exec(`UPDATE "NewsletterJob" SET status = 'CLAIMED', "claimToken" = 'token-a' WHERE id = 'job-a'`);
    assert.equal((await api.settleNewsletterJob(job, 'SUCCEEDED')).settlement, 'COMPLETED');
    const completed = await snapshot();
    assert.equal((await api.settleNewsletterJob(job, 'FAILED', new Error('late error'))).settlement, 'CLAIM_CHANGED');
    assert.deepEqual(await snapshot(), completed);
    assert.deepEqual(completed.filter(row => (row as Values).id !== 'job-a'), before.filter(row => (row as Values).id !== 'job-a'));
  } finally { await db.close(); }
});
