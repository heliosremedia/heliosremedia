import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as policy from './workspace-brand-storage.ts';

function fixture(change: 'actor' | 'asset' | 'image' | 'none') {
  let revoked = false, invalidAsset = false, writes = 0;
  let current = { id: 'owned', photoStorageKey: null as string | null, photoUrl: null as string | null };
  const tx = { $queryRaw: async () => [], testimonial: {
    findFirst: async () => ({ ...current }), aggregate: async () => ({ _max: { displayOrder: 0 } }),
    create: async ({ data }: { data: Record<string, unknown> }) => { writes++; return { id: 'new', ...data }; },
    updateMany: async () => { writes++; return { count: 1 }; }, findFirstOrThrow: async () => current,
  } };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getAdminSession: async () => ({ workspaceId: 'a', userId: 'ua', role: 'EDITOR', sessionVersion: 1 }) },
    '@/lib/prisma': { prisma: { ...tx, $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } },
    '@/lib/blog-ownership': { getContentOwnershipScope: async () => ({ workspaceId: 'a' }) },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if (revoked) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => true },
    '@/lib/workspace-brand-storage': policy, '@/lib/r2-upload': { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    '@/lib/workspace-brand-assets': {
      verifyRegisteredBrandImage: async () => { revoked = change === 'actor'; invalidAsset = change === 'asset'; if (change === 'image') current = { ...current, photoStorageKey: 'legacy.webp', photoUrl: 'https://assets.example/legacy.webp' }; },
      lockRegisteredBrandImage: async () => { if (invalidAsset) throw new Error('INVALID_BRAND_IMAGE'); },
    }, '@/lib/testimonials': { TESTIMONIAL_CHARACTER_LIMIT: 1000 },
  };
  const exports: Record<string, (r: Request) => Promise<Response>> = {};
  const source = readFileSync(new URL('../app/api/admin/testimonials/route.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, URL, console: { error() {} }, require: (name: string) => { if (!(name in modules)) throw new Error(`Unexpected ${name}`); return modules[name]; },
  });
  return { writes: () => writes, call: (method: 'POST' | 'PATCH') => exports[method](new Request('https://example.test/api/admin/testimonials', { method, body: JSON.stringify({ action: 'update', testimonialId: 'owned', agentName: 'Synthetic', testimonial: 'Synthetic content', photoStorageKey: 'workspaces/a/testimonials/replacement.webp' }) })) };
}
for (const method of ['POST', 'PATCH'] as const) {
  for (const change of ['actor', 'asset'] as const) test(`testimonial ${method} rechecks ${change} after image inspection`, async () => {
    const f = fixture(change); assert.equal((await f.call(method)).status, change === 'actor' ? 403 : 400); assert.equal(f.writes(), 0);
  });
  test(`testimonial ${method} preserves successful owned writes`, async () => {
    const f = fixture('none'); assert.equal((await f.call(method)).status, method === 'POST' ? 201 : 200); assert.equal(f.writes(), 1);
  });
}
test('testimonial update rejects an image reference changed during inspection', async () => {
  const f = fixture('image'); assert.equal((await f.call('PATCH')).status, 409); assert.equal(f.writes(), 0);
});
