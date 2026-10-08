import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture() {
  const state = { denied: false, currentRole: 'OWNER', active: true, current: true, failCreate: false, createdEmail: '', writes: 0, audit: 0, locks: [] as string[] };
  const invitation = { id: 'invite', workspaceId: 'a', email: 'old@example.test', displayName: 'Old', role: 'EDITOR', tokenHash: 'hash', expiresAt: new Date(Date.now() + 60000), acceptedAt: null, revokedAt: null };
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray) => { state.locks.push(parts.join('?')); return []; },
    adminInvitation: {
      findFirst: async () => state.current ? { ...invitation, email: 'current@example.test', displayName: 'Current' } : null,
      updateMany: async () => { state.writes++; return { count: 1 }; },
      update: async () => { state.writes++; return invitation; },
      create: async () => { if (state.failCreate) throw new Error('synthetic persistence failure'); state.writes++; return invitation; },
    },
    adminUser: { create: async ({ data }: { data: Record<string, unknown> }) => { state.writes++; state.createdEmail = String(data.email); return { ...data, id: 'new-user' }; } },
    workspaceMembership: { create: async () => { state.writes++; } },
  };
  const prisma = { adminUser: { findUnique: async () => null }, adminInvitation: { ...tx.adminInvitation, findUnique: async () => invitation },
    $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => { const before = state.writes; try { return await fn(tx); } catch (error) { state.writes = before; throw error; } } };
  const modules: Record<string, unknown> = {
    '@/lib/prisma': { prisma },
    '@/lib/workspace-write-access': { requireLockedWorkspaceAdministrator: async () => { if (state.denied) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); return { role: state.currentRole }; } },
    '@/lib/workspace-account-mutation': {}, '@/lib/workspace-context-core': {}, '@/lib/workspace-account-policy': {},
    '@/lib/workspace-membership-lifecycle': { membershipWritesEnabled: () => true },
    '@/lib/workspace-lifecycle/state': { workspaceIsActive: async () => state.active },
    '@/lib/auth/session': { getAdminSession: async () => ({ userId: 'owner', workspaceId: 'a', role: 'OWNER', sessionVersion: 1 }) },
    '@/lib/auth/invitations': { createInvitationToken: () => 'synthetic', hashInvitationToken: () => 'hash' },
    '@/lib/auth/password': { hashPassword: async () => 'synthetic-hash' },
    '@/lib/site': { getAbsoluteUrl: (path: string) => `https://example.test${path}` },
    '@/lib/audit': { recordAuditEvent: async () => { state.audit++; } },
    'next/cache': { revalidatePath: () => {} }, 'next/server': { NextResponse: { json: (data: unknown, init: ResponseInit = {}) => Response.json(data, init) } },
  };
  function load(path: string) {
    const exports = {};
    runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
    return exports as { POST: (request: Request) => Promise<Response>; DELETE: (request: Request) => Promise<Response> };
  }
  return { state, admin: load('app/api/admin/users/route.ts'), accept: load('app/api/auth/accept-invite/route.ts') };
}
const request = (body: unknown) => new Request('https://example.test/api', { method: 'POST', body: JSON.stringify(body) });
const invite = { email: 'invite@example.test', displayName: 'Synthetic', role: 'EDITOR' };
test('invitation creation and revocation recheck locked authority before touching pending invitations', async () => {
  const f = fixture(); f.state.denied = true;
  assert.equal((await f.admin.POST(request(invite))).status, 403);
  assert.equal((await f.admin.DELETE(request({ invitationId: 'invite' }))).status, 403);
  assert.equal(f.state.writes, 0); assert.equal(f.state.audit, 0);
  f.state.denied = false; f.state.currentRole = 'ADMIN';
  assert.equal((await f.admin.POST(request({ ...invite, role: 'OWNER' }))).status, 403);
  assert.equal(f.state.writes, 0);
  assert.equal((await f.admin.POST(request(invite))).status, 201);
});
test('replacement invitation failure cannot leave earlier invitations revoked', async () => {
  const f = fixture(); f.state.failCreate = true;
  await assert.rejects(f.admin.POST(request(invite)), /synthetic persistence failure/);
  assert.equal(f.state.writes, 0); assert.equal(f.state.audit, 0);
});
test('invitation acceptance checks workspace then current binding before creating identity or membership', async () => {
  const f = fixture(), body = { token: 'synthetic', password: 'Synthetic-password-123' };
  f.state.active = false;
  assert.equal((await f.accept.POST(request(body))).status, 409); assert.equal(f.state.writes, 0);
  assert.match(f.state.locks[0], /Workspace/);
  f.state.active = true; f.state.current = false;
  assert.equal((await f.accept.POST(request(body))).status, 409); assert.equal(f.state.writes, 0);
  f.state.current = true;
  assert.equal((await f.accept.POST(request(body))).status, 200); assert.equal(f.state.writes, 3); assert.equal(f.state.createdEmail, 'current@example.test');
});
