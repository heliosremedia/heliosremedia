import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

test("generation recovery rolls back edition, run, job and approval changes when its required audit cannot commit", async () => {
  const db = new PGlite();
  let rejectAudit = true;
  try {
    await db.exec(`
      CREATE TABLE "NewsletterSeries" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "NewsletterEdition" (id TEXT PRIMARY KEY, "seriesId" TEXT REFERENCES "NewsletterSeries", status TEXT, "rowVersion" INT, "approvedRevisionId" TEXT);
      CREATE TABLE "NewsletterGenerationRun" (id TEXT PRIMARY KEY, "editionId" TEXT REFERENCES "NewsletterEdition", attempt INT, status TEXT, "instructionsSnapshot" JSONB, "completedAt" TIMESTAMPTZ, "errorCode" TEXT, "errorMessage" TEXT);
      CREATE TABLE "NewsletterJob" (id TEXT PRIMARY KEY, "editionId" TEXT REFERENCES "NewsletterEdition", type TEXT, status TEXT, "leaseExpiresAt" TIMESTAMPTZ, "claimToken" TEXT, "completedAt" TIMESTAMPTZ, "lastErrorCode" TEXT, "lastErrorMessage" TEXT);
      CREATE TABLE "NewsletterApproval" (id TEXT PRIMARY KEY, "editionId" TEXT REFERENCES "NewsletterEdition", "revokedAt" TIMESTAMPTZ, "revocationReason" TEXT);
      CREATE TABLE "PreservedContent" (id TEXT PRIMARY KEY, content TEXT);
      CREATE TABLE "RecoveryAudit" ("workspaceId" TEXT, "entityId" TEXT);
      INSERT INTO "NewsletterSeries" VALUES ('series-a', 'a'), ('series-b', 'b');
      INSERT INTO "NewsletterEdition" VALUES ('edition-a', 'series-a', 'GENERATING', 6, 'revision-a'), ('edition-b', 'series-b', 'GENERATING', 6, 'revision-b');
      INSERT INTO "NewsletterJob" (id, "editionId", type, status, "leaseExpiresAt", "claimToken") VALUES
        ('job-a','edition-a','GENERATE','CLAIMED','2020-01-01','token-a'), ('pending-a','edition-a','GENERATE','PENDING',null,null),
        ('job-b','edition-b','GENERATE','CLAIMED','2020-01-01','token-b');
      INSERT INTO "NewsletterApproval" (id, "editionId") VALUES ('approval-a','edition-a'), ('approval-b','edition-b');
      INSERT INTO "PreservedContent" VALUES ('revision-a','Existing draft content');
    `);
    for (const company of ['a', 'b']) await db.query(`INSERT INTO "NewsletterGenerationRun" (id,"editionId",attempt,status,"instructionsSnapshot") VALUES ($1,$2,1,'RUNNING',$3)`, [
      `run-${company}`, `edition-${company}`, JSON.stringify({ workspaceId: company, seriesId: `series-${company}`, execution: { kind: 'BACKGROUND', jobId: `job-${company}`, editionVersion: 6 } }),
    ]);
    // Translate only the ORM operations used by the real service into isolated SQL.
    // This exercises database atomicity, not the hosted Prisma adapter or concurrent locks.
    const exports: { recoverNewsletterGeneration?: (id: string, version: number, run: string, actor: unknown) => Promise<unknown> } = {};
    const modules: Record<string, unknown> = {
      'server-only': {}, '@/lib/blog-ownership': { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      '@/lib/workspace-write-access': { requireLockedWorkspaceAdministrator: async () => undefined },
      '@/lib/prisma': { prisma: { $transaction: async (operation: (tx: unknown) => Promise<unknown>) => db.transaction(async sql => {
        type Values = Record<string, unknown>;
        function predicate(where: Values, values: unknown[]): string {
          const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
          return Object.entries(where).map(([key, value]) => {
            if (key === 'series') return `"seriesId" IN (SELECT id FROM "NewsletterSeries" WHERE "workspaceId" = ${bind((value as Values).workspaceId)})`;
            if (value === null) return `"${key}" IS NULL`;
            if (typeof value === 'object' && !(value instanceof Date)) {
              const [operator, operand] = Object.entries(value as Values)[0];
              assert.ok(['lte', 'not'].includes(operator));
              return `"${key}" ${operator === 'lte' ? '<=' : '<>'} ${bind(operand)}`;
            }
            return `"${key}" = ${bind(value)}`;
          }).join(' AND ');
        }
        function model(table: string) {
          return {
            findFirst: async ({ where }: { where: Values }) => {
              const values: unknown[] = [];
              const result = await sql.query<Values>(`SELECT * FROM "${table}" WHERE ${predicate(where, values)} LIMIT 1`, values);
              const row = result.rows[0];
              if (row && table === 'NewsletterEdition') row.generationRuns = (await sql.query(`SELECT * FROM "NewsletterGenerationRun" WHERE "editionId" = $1 ORDER BY attempt DESC LIMIT 1`, [row.id])).rows;
              return row ?? null;
            },
            count: async ({ where }: { where: Values }) => {
              const values: unknown[] = [];
              return Number((await sql.query<{ count: number }>(`SELECT count(*) FROM "${table}" WHERE ${predicate(where, values)}`, values)).rows[0].count);
            },
            updateMany: async ({ where, data }: { where: Values; data: Values }) => {
              const values: unknown[] = [];
              const assignments = Object.entries(data).map(([key, value]) => {
                if (value && typeof value === 'object' && !(value instanceof Date)) { assert.equal((value as Values).increment, 1); return `"${key}" = "${key}" + 1`; }
                values.push(value); return `"${key}" = $${values.length}`;
              });
              return { count: (await sql.query(`UPDATE "${table}" SET ${assignments.join(',')} WHERE ${predicate(where, values)}`, values)).affectedRows };
            },
          };
        }
        return operation({
          $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await sql.query(parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, ''), values)).rows,
          newsletterEdition: model('NewsletterEdition'), newsletterGenerationRun: model('NewsletterGenerationRun'), newsletterJob: model('NewsletterJob'), newsletterApproval: model('NewsletterApproval'),
          auditEvent: { create: async ({ data }: { data: { workspaceId: string; entityId: string } }) => {
            if (rejectAudit) throw new Error('Required audit failed');
            return sql.query(`INSERT INTO "RecoveryAudit" VALUES ($1,$2)`, [data.workspaceId, data.entityId]);
          } },
        });
      }) } },
    };
    runInNewContext(ts.transpileModule(readFileSync(new URL('./generation-recovery.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
    });
    const snapshot = async () => {
      const tables = ['NewsletterEdition', 'NewsletterGenerationRun', 'NewsletterJob', 'NewsletterApproval', 'PreservedContent'];
      return Promise.all(tables.map(table => db.query<Record<string, unknown>>(`SELECT * FROM "${table}" ORDER BY id`).then(result => result.rows)));
    };
    const before = await snapshot();
    const recover = (id = 'edition-a', run = 'run-a') => exports.recoverNewsletterGeneration!(id, 6, run, { workspaceId: 'a', userId: 'admin', sessionVersion: 1 });
    await assert.rejects(recover(), /Required audit failed/);
    assert.deepEqual(await snapshot(), before);
    assert.equal((await db.query(`SELECT * FROM "RecoveryAudit"`)).rows.length, 0);
    rejectAudit = false;
    await assert.rejects(recover('edition-b', 'run-b'), /RECOVERY_CHANGED/);
    assert.deepEqual(await snapshot(), before);
    await recover();
    const after = await snapshot();
    assert.equal(after[0][0].status, 'NEEDS_REVIEW'); assert.equal(after[0][0].rowVersion, 7); assert.equal(after[0][0].approvedRevisionId, null);
    assert.equal(after[1][0].status, 'FAILED'); assert.equal(after[2][0].claimToken, null); assert.equal(after[2][2].status, 'CANCELLED');
    assert.ok(after[3][0].revokedAt); assert.deepEqual(after[4], before[4]);
    for (const index of [0, 1, 2, 3]) assert.deepEqual(after[index][1], before[index][1]);
    assert.equal((await db.query(`SELECT * FROM "RecoveryAudit"`)).rows.length, 1);
    await assert.rejects(recover(), /RECOVERY_CHANGED/);
    assert.deepEqual(await snapshot(), after);
  } finally { await db.close(); }
});
