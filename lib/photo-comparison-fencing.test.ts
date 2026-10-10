import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { resolveBrandImage } from './workspace-brand-storage.ts';

function fixture(change: 'actor' | 'asset' | 'image' | 'none') {
  let inspected = false, writes = 0;
  const key = 'workspaces/a/photo-comparison/image.webp', url = `https://assets.example/${key}`;
  const existing = { updatedAt: new Date('2026-10-07T00:00:00Z'), detailImageStorageKey: key, detailImageUrl: url, pairs: [{ id: 'pair', standardImageStorageKey: key, standardImageUrl: url, editorialImageStorageKey: key, editorialImageUrl: url }] };
  const tx = { $queryRaw: async () => [], photoComparisonPage: {
    findUnique: async () => ({ updatedAt: existing.updatedAt }),
    upsert: async () => { writes++; return { id: 'page' }; }, findUniqueOrThrow: async () => existing,
  }, photoComparisonPair: { deleteMany: async () => {}, createMany: async () => {} } };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getAdminSession: async () => ({ workspaceId: 'a', userId: 'ua', role: 'EDITOR', sessionVersion: 1 }) },
    '@/lib/prisma': { prisma: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if (inspected && change === 'actor') throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => true },
    '@/lib/r2-upload': { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    '@/lib/photo-comparison-storage': { resolvePhotoComparisonImage: (id: string, submitted: Parameters<typeof resolveBrandImage>[2], old: Parameters<typeof resolveBrandImage>[3], publicUrl: Parameters<typeof resolveBrandImage>[4]) => resolveBrandImage(id, 'photo-comparison', submitted, old, publicUrl) },
    '@/lib/photo-comparison': { defaultPhotoComparisonContent: { title: 'Synthetic' }, getPhotoComparisonPage: async () => inspected && change === 'image' ? { ...existing, detailImageStorageKey: 'legacy.webp', detailImageUrl: 'https://legacy.example/new.webp' } : existing },
    '@/lib/workspace-brand-assets': { verifyRegisteredBrandImage: async () => { inspected = true; }, lockRegisteredBrandImage: async () => { if (change === 'asset') throw new Error('INVALID_BRAND_IMAGE'); } },
  };
  const exports: { PATCH?: (r: Request) => Promise<Response> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../app/api/admin/photo-comparison/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, URL, Date, console: { error() {} }, require: (name: string) => { if (!(name in modules)) throw new Error(name); return modules[name]; },
  });
  return { writes: () => writes, call: () => exports.PATCH!(new Request('https://example.test/api', { method: 'PATCH', body: JSON.stringify({ ...existing, content: { title: 'Changed' }, detailImageAlt: 'Detail', pairs: [{ ...existing.pairs[0], label: 'Pair', alt: 'Image', caption: 'Caption' }] }) })) };
}
for (const [change, expected] of [['actor', 403], ['asset', 400], ['image', 409]] as const) test(`comparison save rechecks ${change} after image inspection`, async () => {
  const f = fixture(change); assert.equal((await f.call()).status, expected); assert.equal(f.writes(), 0);
});
test('comparison save retains owned page replacement', async () => {
  const f = fixture('none'); assert.equal((await f.call()).status, 200); assert.equal(f.writes(), 1);
});
