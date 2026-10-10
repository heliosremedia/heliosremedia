import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const input = { title: 'Synthetic home', slug: 'synthetic-home', shortDescription: '', city: 'Fort Collins', state: 'Colorado', locationLabel: '', projectType: 'Listing Media', propertyType: '' };
const requestId = '00000000-0000-4000-8000-000000000001';
function fixture() {
  const rows: Array<Record<string, unknown>> = []; let denied = false, admissions = 0;
  const tx = { project: {
    findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => rows.find(row => row.id === where.id && row.workspaceId === where.workspaceId) ?? null,
    findUnique: async ({ where }: { where: { slug: string } }) => rows.find(row => row.slug === where.slug) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => { rows.push(data); return { id: data.id }; },
  } };
  const modules: Record<string, unknown> = {
    'server-only': {}, 'node:crypto': { createHash },
    '@/lib/prisma': { prisma: { $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx) } },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { admissions++; if (denied) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
  };
  const exports = {} as { createProjectDraft: (actor: { workspaceId: string; userId: string; sessionVersion: number }, requestId: string, values: typeof input) => Promise<{ id: string; reused: boolean }> };
  runInNewContext(ts.transpileModule(readFileSync('lib/project-draft.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return { rows, deny: () => { denied = true; }, admissions: () => admissions, call: (workspaceId = 'a', values = input, key = requestId) => exports.createProjectDraft({ workspaceId, userId: `u${workspaceId}`, sessionVersion: 1 }, key, values) };
}
test('draft submission replay returns the existing owned project without another write and still reauthorizes', async () => {
  const f = fixture(); const first = await f.call(); assert.equal(first.reused, false);
  const replay = await f.call(); assert.equal(replay.id, first.id); assert.equal(replay.reused, true); assert.equal(f.rows.length, 1); assert.equal(f.rows[0].status, 'DRAFT');
  f.deny(); await assert.rejects(f.call(), /WORKSPACE_WRITE_FORBIDDEN/); assert.equal(f.rows.length, 1); assert.equal(f.admissions(), 3);
});
test('same request token in another workspace has a distinct identity and unique portfolio slug', async () => {
  const f = fixture(); const a = await f.call(), b = await f.call('b'); assert.notEqual(a.id, b.id); assert.equal(f.rows[1].workspaceId, 'b'); assert.equal(f.rows[1].slug, 'synthetic-home-2');
});
test('invalid requests and overlong values never enter persistence', async () => {
  const f = fixture(); await assert.rejects(f.call('a', input, 'bad'), /REQUEST_INVALID/);
  await assert.rejects(f.call('a', { ...input, title: '' }), /TITLE_REQUIRED/);
  await assert.rejects(f.call('a', { ...input, title: 'x'.repeat(121) }), /INPUT_INVALID/);
  assert.equal(f.rows.length, 0); assert.equal(f.admissions(), 0);
});
