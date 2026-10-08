import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
function fixture() {
  const state = { tenant: true, enabled: 'true', clock: 0, auditFails: false, expiryDuringAudit: false, committed: 0, transactions: 0 };
  const grant = { id: 'grant', workspaceId: 'a', operatorId: 'ub', grantedById: 'ua', scope: 'DIAGNOSTICS', createdAt: new Date(0), expiresAt: new Date(60000), revokedAt: null };
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray) => parts.join('').includes('clock_timestamp') ? [{ now: new Date(state.clock) }] : parts.join('').includes('count(*)') ? [{ projects: 2, activeMemberships: 1 }] : [],
    platformSupportOperator: { findUnique: async () => ({ enabled: true }) },
    adminUser: { findUnique: async ({ where }: { where: { id: string } }) => ({ active: true, workspaceId: where.id === 'ua' ? 'a' : 'b', sessionVersion: 1 }) },
    workspaceMembership: { findUnique: async () => ({ status: 'ACTIVE', role: 'OWNER' }) },
    supportAccessGrant: { findUnique: async () => grant },
    auditEvent: { create: async () => { if (state.auditFails) throw new Error('private audit error'); if (state.expiryDuringAudit) state.clock = 60001; } },
  };
  const prisma = { supportAccessGrant: tx.supportAccessGrant, $transaction: async (fn: (tx: unknown) => Promise<unknown>) => { state.transactions++; const result = await fn(tx); state.committed++; return result; } };
  const modules: Record<string, unknown> = { 'server-only': {}, 'node:crypto': { randomUUID: () => 'request' }, '@/lib/workspace-lifecycle/state': { workspaceIsActive: async () => true },
    '@/lib/prisma': { prisma }, '@/lib/workspace-context-core': { tenantContextEnabled: () => state.tenant }, '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => ({ role: 'OWNER' }) } };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('./platform-support/access.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Error, process: { env: new Proxy({}, { get: () => state.enabled }) }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const api = exports as { readSupportDiagnostics: (actor: unknown, id: unknown) => Promise<unknown>; createSupportGrant: (actor: unknown, body: unknown) => Promise<unknown> };
  return { state, grant, read: () => api.readSupportDiagnostics({ userId: 'ub', workspaceId: 'b', sessionVersion: 1 }, 'grant'), create: (body: unknown) => api.createSupportGrant({ userId: 'ua', workspaceId: 'a', sessionVersion: 1 }, body) };
}
for (const mode of ['flag-off', 'tenant-off']) test(`support disabled ${mode} does not enter database transaction`, async () => {
  const f = fixture(); if (mode === 'flag-off') f.state.enabled = ''; else f.state.tenant = false;
  await assert.rejects(f.read()); assert.equal(f.state.transactions, 0);
});
test('support returns only the fixed projection after audit transaction commits', async () => {
  const f = fixture(); assert.equal(JSON.stringify(await f.read()), JSON.stringify({ workspaceId: 'a', scope: 'DIAGNOSTICS', countLimit: 10000, counts: { projects: 2, activeMemberships: 1 } })); assert.equal(f.state.committed, 1);
});
test('support audit failure releases no diagnostics even if denial audit also fails', async () => { const f = fixture(); f.state.auditFails = true; await assert.rejects(f.read()); assert.equal(f.state.committed, 0); });
test('support expiry during audit rolls back allowed read', async () => { const f = fixture(); f.state.expiryDuringAudit = true; await assert.rejects(f.read()); assert.equal(f.state.committed, 1, 'only separate denial audit commits'); });
for (const defect of ['scope', 'future', 'overlong', 'revoked', 'self']) test(`support rejects persisted ${defect} grant`, async () => {
  const f = fixture(); if (defect === 'scope') f.grant.scope = 'WRITE'; if (defect === 'future') f.grant.createdAt = new Date(1); if (defect === 'overlong') f.grant.expiresAt = new Date(1800001); if (defect === 'revoked') Object.assign(f.grant, { revokedAt: new Date() }); if (defect === 'self') f.grant.grantedById = 'ub'; await assert.rejects(f.read());
});
test('support grant input rejects scope, lifetime and missing reason before a transaction', async () => {
  const f = fixture(); const valid = { operatorId: 'ub', scope: 'DIAGNOSTICS', durationMinutes: 30, reason: 'synthetic' };
  for (const patch of [{ scope: 'WRITE' }, { durationMinutes: 31 }, { durationMinutes: -1 }, { durationMinutes: '30' }, { reason: '' }]) await assert.rejects(f.create({ ...valid, ...patch })); assert.equal(f.state.transactions, 0);
});
test('support migration starts empty, preserves identities, and enforces enrollment references', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY); CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY); INSERT INTO "Workspace" VALUES ('a'),('b'); INSERT INTO "AdminUser" VALUES ('ua'),('ub');`);
    await db.exec(readFileSync(new URL('../prisma/migrations/20261007140000_support_access_foundation/migration.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('SELECT * FROM "PlatformSupportOperator"')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM "SupportAccessGrant"')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM "AdminUser"')).rows.length, 2);
    const grant = `INSERT INTO "SupportAccessGrant" (id,"workspaceId","operatorId","grantedById",reason,scope,"expiresAt") VALUES ('g','a','ub','ua','synthetic','DIAGNOSTICS',now()+interval '30 minutes')`;
    await assert.rejects(db.exec(grant), /foreign key/i);
    await db.exec(`INSERT INTO "PlatformSupportOperator" ("userId","updatedAt") VALUES ('ub',now())`);
    assert.deepEqual((await db.query('SELECT enabled FROM "PlatformSupportOperator"')).rows, [{ enabled: false }]);
    await db.exec(grant);
    await assert.rejects(db.exec(`DELETE FROM "PlatformSupportOperator" WHERE "userId"='ub'`), /foreign key/i);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`), /foreign key/i);
  } finally { await db.close(); }
});
