import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function fixture() {
  const state = { denied: false, found: true, clients: 1, writes: 0, role: 'OWNER', version: new Date('2026-01-01T00:00:00.000Z') };
  const tx = {
    $queryRaw: async () => state.found ? [{ id: 'owned' }] : [],
    project: { findFirst: async () => ({ updatedAt: state.version }), update: async ({ where, data }: { where: { workspaceId: string }; data: { updatedAt: Date; title: string; slug: string } }) => { assert.equal(where.workspaceId, 'a'); state.writes++; state.version = data.updatedAt; return { id: 'owned', title: data.title, slug: data.slug, updatedAt: state.version }; } },
    projectAgent: { deleteMany: async () => { state.writes++; }, createMany: async () => { state.writes++; } },
    projectDetails: { upsert: async () => { state.writes++; } },
    communicationClientWorkspace: { count: async () => state.clients },
  };
  const modules: Record<string, unknown> = {
    'next/cache': { revalidatePath() {} }, 'next/server': { NextResponse: Response },
    '@/lib/auth/session': { getAdminSession: async () => ({ workspaceId: 'a', userId: 'ua', role: state.role, sessionVersion: 1 }) },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if (state.denied) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/prisma': { prisma: { project: { findFirst: async ({ where }: { where: { id: unknown } }) => typeof where.id === 'string' ? { id: 'owned', slug: 'before' } : null },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => { const before = state.writes; try { return await fn(tx); } catch (e) { state.writes = before; throw e; } },
    } },
  };
  const exports = {} as { PATCH: (req: Request, c: { params: Promise<{ projectId: string }> }) => Promise<Response> };
  runInNewContext(ts.transpileModule(readFileSync('app/api/admin/projects/[projectId]/details/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, URL, Error, console: { error() {} }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return { state, send: (patch = {}) => exports.PATCH(new Request('http://localhost/api', { method: 'PATCH', body: JSON.stringify({ title: 'Updated', slug: 'updated', expectedUpdatedAt: '2026-01-01T00:00:00.000Z', ...patch }) }), { params: Promise.resolve({ projectId: 'owned' }) }) };
}
test('project details require reviewed revision and advance it; stale replay makes no writes', async () => {
  const f = fixture();
  for (const expectedUpdatedAt of [null, '', 'invalid', 123]) assert.equal((await f.send({ expectedUpdatedAt })).status, 409);
  assert.equal(f.state.writes, 0);
  const reply = await f.send(); assert.equal(reply.status, 200); assert.ok(Date.parse((await reply.json()).project.updatedAt) > Date.parse('2026-01-01'));
  const writes = f.state.writes; assert.equal((await f.send()).status, 409); assert.equal(f.state.writes, writes);
});
test('project details reauthorize and lock owned project before details or agent changes', async () => {
  const f = fixture(); f.state.denied = true; assert.equal((await f.send()).status, 403); assert.equal(f.state.writes, 0);
  f.state.denied = false; f.state.found = false; assert.equal((await f.send()).status, 404); assert.equal(f.state.writes, 0);
  f.state.found = true; f.state.clients = 0; assert.equal((await f.send({ agents: [{ clientId: 'foreign', displayNameSnapshot: 'Foreign' }] })).status, 400); assert.equal(f.state.writes, 0);
  f.state.role = 'VIEWER'; assert.equal((await f.send()).status, 403); assert.equal(f.state.writes, 0);
});
