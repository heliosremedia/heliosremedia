import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import type * as Api from './workspace-lifecycle/core.ts';
const migration = readFileSync(new URL('../prisma/migrations/20261008123000_workspace_lifecycle_foundation/migration.sql', import.meta.url), 'utf8');
function load(state: { enabled: boolean; tenant: boolean }) {
  const modules: Record<string, unknown> = { 'server-only': {}, 'node:crypto': { randomUUID: () => 'request' }, '../workspace-context-core.ts': { tenantContextEnabled: () => state.tenant } };
  function source(path: string) {
    const exports = {};
    runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, process: { env: new Proxy({}, { get: () => state.enabled ? 'true' : undefined }) }, require: (id: string) => { if (id === './state.ts') return source('./workspace-lifecycle/state.ts'); assert.ok(id in modules, id); return modules[id]; } });
    return exports;
  }
  return source('./workspace-lifecycle/core.ts') as typeof Api;
}
const actor = { userId: 'ub', workspaceId: 'b', sessionVersion: 1 };
const input = { workspaceId: 'a', expectedRevision: 0, state: 'SUSPENDED' as const, reason: 'Synthetic qualification' };
test('lifecycle flag defaults off and tenant compatibility mode denies transitions without DB access', async () => {
  for (const state of [{ enabled: false, tenant: true }, { enabled: true, tenant: false }]) {
    const api = load(state); await assert.rejects(api.transitionWorkspaceLifecycle({} as never, actor, input));
    assert.equal(await api.workspaceIsActive({} as never, 'a'), true);
  }
});
test('lifecycle validates bounded input before entering a transaction', async () => {
  const api = load({ enabled: true, tenant: true });
  for (const patch of [{ workspaceId: '../a' }, { expectedRevision: -1 }, { expectedRevision: 2147483647 }, { expectedRevision: 0.5 }, { reason: '' }, { reason: 'x'.repeat(601) }, { state: 'ARCHIVED' }]) await assert.rejects(api.transitionWorkspaceLifecycle({} as never, actor, { ...input, ...patch } as never), api.LifecycleInvalid);
});
test('lifecycle migration and actual transition core preserve identity and require independent audited authority', async () => {
  const db = new PGlite(); const api = load({ enabled: true, tenant: true }); let auditFails = false;
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY); CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT, active BOOLEAN, "sessionVersion" INTEGER); CREATE TABLE "WorkspaceMembership" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "userId" TEXT, status TEXT); CREATE TABLE "AuditEvent" (id SERIAL PRIMARY KEY, metadata JSONB); INSERT INTO "Workspace" VALUES ('a'),('b'); INSERT INTO "AdminUser" VALUES ('ua','a',true,1),('ub','b',true,1); INSERT INTO "WorkspaceMembership" VALUES ('ma','a','ua','ACTIVE'),('mb','b','ub','ACTIVE');`);
    await db.exec(migration);
    assert.deepEqual((await db.query('SELECT "lifecycleState", "lifecycleRevision" FROM "Workspace" ORDER BY id')).rows, [{ lifecycleState: 'ACTIVE', lifecycleRevision: 0 }, { lifecycleState: 'ACTIVE', lifecycleRevision: 0 }]);
    assert.equal((await db.query('SELECT * FROM "PlatformLifecycleOperator"')).rows.length, 0);
    const adapter = { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => db.transaction(async sql => {
      const find = (table: string, where: Record<string, unknown>) => sql.query(`SELECT * FROM "${table}" WHERE ${Object.keys(where).map((key, i) => `"${key}"=$${i+1}`).join(' AND ')}`, Object.values(where)).then(r => r.rows[0]);
      return fn({
        $queryRaw: (parts: TemplateStringsArray, ...values: unknown[]) => sql.query(parts.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, ''), values).then(r => r.rows),
        workspace: { findUnique: ({ where }: { where: Record<string, unknown> }) => find('Workspace', where), update: ({ where, data }: { where: { id: string }; data: { lifecycleState: string } }) => sql.query('UPDATE "Workspace" SET "lifecycleState"=$1,"lifecycleRevision"="lifecycleRevision"+1 WHERE id=$2 RETURNING *', [data.lifecycleState, where.id]).then(r => r.rows[0]) },
        adminUser: { findUnique: ({ where }: { where: Record<string, unknown> }) => find('AdminUser', where) },
        workspaceMembership: { findUnique: ({ where }: { where: { workspaceId_userId: Record<string, unknown> } }) => find('WorkspaceMembership', where.workspaceId_userId) },
        platformLifecycleOperator: { findUnique: ({ where }: { where: Record<string, unknown> }) => find('PlatformLifecycleOperator', where) },
        auditEvent: { create: ({ data }: { data: { metadata: unknown } }) => { if (auditFails) throw new Error('synthetic audit unavailable'); return sql.query('INSERT INTO "AuditEvent" (metadata) VALUES ($1)', [JSON.stringify(data.metadata)]); } },
      });
    }) } as unknown as Parameters<typeof api.transitionWorkspaceLifecycle>[0];
    const transition = (patch = {}) => api.transitionWorkspaceLifecycle(adapter, actor, { ...input, ...patch });
    await assert.rejects(transition(), api.LifecycleDenied);
    await db.exec(`INSERT INTO "PlatformLifecycleOperator" ("userId","updatedAt") VALUES ('ub',now())`);
    await assert.rejects(transition(), api.LifecycleDenied);
    await db.exec(`UPDATE "PlatformLifecycleOperator" SET enabled=true`);
    auditFails = true; await assert.rejects(transition()); auditFails = false;
    assert.deepEqual((await db.query(`SELECT "lifecycleState","lifecycleRevision" FROM "Workspace" WHERE id='a'`)).rows, [{ lifecycleState: 'ACTIVE', lifecycleRevision: 0 }]);
    assert.equal((await db.query('SELECT * FROM "AuditEvent"')).rows.length, 0);
    const result = await transition(); assert.equal(result.lifecycleState, 'SUSPENDED'); assert.equal(result.lifecycleRevision, 1);
    await assert.rejects(transition(), api.LifecycleConflict);
    await assert.rejects(transition({ expectedRevision: 1 }), api.LifecycleConflict);
    await assert.rejects(api.transitionWorkspaceLifecycle(adapter, { ...actor, sessionVersion: 2 }, { ...input, expectedRevision: 1, state: 'ACTIVE' }), api.LifecycleDenied);
    await transition({ expectedRevision: 1, state: 'ACTIVE' });
    assert.equal((await db.query('SELECT * FROM "AuditEvent"')).rows.length, 2);
    await db.exec(`UPDATE "Workspace" SET "lifecycleState"='SUSPENDED' WHERE id='b'`);
    await assert.rejects(transition({ expectedRevision: 2 }), api.LifecycleDenied);
    await assert.rejects(db.exec(`DELETE FROM "AdminUser" WHERE id='ub'`), /foreign key/i);
  } finally { await db.close(); }
});
