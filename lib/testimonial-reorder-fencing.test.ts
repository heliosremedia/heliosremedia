import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture(change: 'revoked' | 'inserted' | 'none') {
  const rows = [{ id: 'one', rowVersion: 0 }, { id: 'two', rowVersion: 0 }];
  let revoked = false, writes = 0;
  const tx = {
    $queryRaw: async () => [],
    testimonial: {
      findMany: async () => rows.map(r => ({ ...r })),
      updateMany: async () => { writes++; return { count: 1 }; },
    },
  };
  const prisma = { ...tx, $transaction: async (fn: (client: typeof tx) => unknown) => {
    if (change === 'revoked') revoked = true;
    if (change === 'inserted') rows.push({ id: 'three', rowVersion: 0 });
    return fn(tx);
  } };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getAdminSession: async () => ({ workspaceId: 'a', userId: 'ua', role: 'EDITOR', sessionVersion: 1 }) },
    '@/lib/prisma': { prisma }, '@/lib/blog-ownership': { getContentOwnershipScope: async () => ({ workspaceId: 'a' }) },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if (revoked) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => true },
    '@/lib/workspace-brand-storage': {}, '@/lib/r2-upload': {}, '@/lib/workspace-brand-assets': {}, '@/lib/testimonials': {},
  };
  const exports: { PATCH?: (r: Request) => Promise<Response> } = {};
  const source = readFileSync(new URL('../app/api/admin/testimonials/route.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, URL, console: { error() {} }, require: (name: string) => { if (!(name in modules)) throw new Error(`Unexpected ${name}`); return modules[name]; },
  });
  return { writes: () => writes, call: () => exports.PATCH!(new Request('https://example.test/api/admin/testimonials', { method: 'PATCH', body: JSON.stringify({ action: 'reorder', testimonialIds: ['two', 'one'], versions: { one: 0, two: 0 } }) })) };
}

test('testimonial reorder rejects editor revocation at transaction admission without writes', async () => {
  const f = fixture('revoked'); assert.equal((await f.call()).status, 403); assert.equal(f.writes(), 0);
});
test('testimonial reorder rejects a newly inserted collection member before writing', async () => {
  const f = fixture('inserted'); assert.equal((await f.call()).status, 409); assert.equal(f.writes(), 0);
});
test('testimonial reorder preserves the complete-order and version response contract', async () => {
  const f = fixture('none'); const response = await f.call(); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, testimonialIds: ['two', 'one'], versions: { two: 1, one: 1 } }); assert.equal(f.writes(), 2);
});
