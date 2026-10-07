import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture(revoked: boolean, inserted: boolean) {
  let inside = false, writes = 0;
  const trustedLogo = {
    findMany: async () => inside && inserted ? [{ id: 'one' }, { id: 'new' }] : [{ id: 'one' }],
    updateMany: async () => { writes++; return { count: 1 }; }, findFirstOrThrow: async () => ({ id: 'one', published: true }),
  };
  const tx = { $queryRaw: async () => [], trustedLogo };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getAdminSession: async () => ({ workspaceId: 'a', userId: 'ua', role: 'EDITOR', sessionVersion: 1 }) },
    '@/lib/prisma': { prisma: { ...tx, $transaction: async (fn: ((t: typeof tx) => unknown) | Promise<unknown>[]) => { inside = true; return typeof fn === 'function' ? fn(tx) : Promise.all(fn); } } },
    '@/lib/blog-ownership': { getContentOwnershipScope: async () => ({ workspaceId: 'a' }) },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if (revoked) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => true },
    '@/lib/workspace-brand-storage': {}, '@/lib/r2-upload': {}, '@/lib/workspace-brand-assets': {},
  };
  const exports: { PATCH?: (r: Request) => Promise<Response> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../app/api/admin/trusted-logos/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, URL, console: { error() {} }, require: (name: string) => { if (!(name in modules)) throw new Error(name); return modules[name]; },
  });
  return { writes: () => writes, call: (action: string) => exports.PATCH!(new Request('https://example.test/api', { method: 'PATCH', body: JSON.stringify({ action, logoId: 'one', logoIds: ['one'], published: true }) })) };
}
for (const action of ['set-published', 'reorder']) test(`logo ${action} rejects revoked current authority`, async () => {
  const f = fixture(true, false); assert.equal((await f.call(action)).status, 403); assert.equal(f.writes(), 0);
});
test('logo reorder validates collection inside its transaction', async () => {
  const f = fixture(false, true); assert.equal((await f.call('reorder')).status, 409); assert.equal(f.writes(), 0);
});
test('logo publication and reorder preserve success contracts', async () => {
  const f = fixture(false, false); assert.equal((await f.call('set-published')).status, 200); const response = await f.call('reorder');
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true, logoIds: ['one'] }); assert.equal(f.writes(), 2);
});
