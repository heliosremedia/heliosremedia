import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture() {
  const state = { denied: false, drift: false, auditFails: false, writes: 0, events: [] as Record<string, unknown>[] };
  const current = { id: 'ua', workspaceId: 'a', email: 'a@example.test', passwordHash: 'old-hash' };
  const update = async ({ where }: { where: Record<string, unknown> }) => { assert.equal(where.id, 'ua'); state.writes++; return { id: 'ua' }; };
  const tx = { adminUser: { findFirst: async () => ({ ...current, passwordHash: state.drift ? 'changed-hash' : current.passwordHash }), update },
    auditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { if (state.auditFails) throw new Error('Synthetic audit failure'); state.events.push(data); } } };
  const prisma = { adminUser: { findUnique: async () => ({ ...current }), findFirst: async () => null, update },
    $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => { const writes = state.writes, events = state.events.length;
      try { return await fn(tx); } catch (error) { state.writes = writes; state.events.length = events; throw error; } } };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: { json: (data: unknown, init: ResponseInit = {}) => Response.json(data, init) } },
    'next/cache': { revalidatePath: () => {} }, '@/lib/prisma': { prisma },
    '@/lib/auth/session': { getAdminSession: async () => ({ userId: 'ua', workspaceId: 'a', sessionVersion: 1 }) },
    '@/lib/auth/password': { hashPassword: async () => 'new-hash', verifyPassword: async () => true },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if (state.denied) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/audit': { recordAuditEvent: async (data: Record<string, unknown>) => { if (!state.auditFails) state.events.push(data); } },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('app/api/admin/profile/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Error, console: { error: () => {} }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const api = exports as { PATCH: (request: Request) => Promise<Response> };
  const send = (changes = {}) => api.PATCH(new Request('https://example.test/api/admin/profile', { method: 'PATCH', body: JSON.stringify({ displayName: 'Synthetic', email: current.email, ...changes }) }));
  return { state, send };
}
test('profile edits recheck current authority and verified credential snapshot before persistence', async () => {
  const f = fixture(); f.state.denied = true;
  assert.equal((await f.send()).status, 403); assert.equal(f.state.writes, 0);
  f.state.denied = false; f.state.drift = true;
  assert.equal((await f.send({ newPassword: 'New-password-123' })).status, 403); assert.equal(f.state.writes, 0);
});
test('profile security audit has owned workspace and failed audit rolls back credentials', async () => {
  const f = fixture(); f.state.auditFails = true;
  assert.equal((await f.send({ newPassword: 'New-password-123' })).status, 500); assert.equal(f.state.writes, 0);
  f.state.auditFails = false;
  assert.equal((await f.send({ newPassword: 'New-password-123' })).status, 200);
  assert.equal(f.state.events[0].workspaceId, 'a'); assert.equal(f.state.events[0].actorId, 'ua');
});
test('ordinary profile edits preserve existing success contract without a security audit', async () => {
  const f = fixture(); const response = await f.send(); assert.equal(response.status, 200);
  assert.equal((await response.json()).signedOut, false); assert.equal(f.state.events.length, 0);
});
