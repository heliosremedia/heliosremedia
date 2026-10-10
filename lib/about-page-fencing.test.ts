import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as policy from './workspace-brand-storage.ts';

function fixture(change: 'actor' | 'asset' | 'image' | 'none') {
  let inspected = false, writes = 0;
  const key = 'workspaces/a/about/image.webp', url = `https://assets.example/${key}`;
  const existing = { id: 'page', heroImageStorageKey: key, heroImageUrl: url };
  const tx = { $queryRaw: async () => [], aboutPageContent: {
    findUnique: async () => inspected && change === 'image' ? { ...existing, heroImageStorageKey: 'legacy.webp', heroImageUrl: 'https://legacy.example/new.webp' } : existing,
    upsert: async () => { writes++; return existing; },
  } };
  const fields = ['heroEyebrow', 'heroHeadline', 'heroBody', 'heroImageAlt', 'storyEyebrow', 'storyIntro', 'storyHeadline', 'storyBodyLeft', 'storyBodyRight', 'founderEyebrow', 'founderFirstName', 'founderRole', 'founderBody', 'founderSignature', 'founderTitle', 'founderTeamNote', 'founderImageAlt', 'principlesEyebrow', 'principlesHeadline', 'principlesIntro', 'galleryOneAlt', 'galleryTwoAlt', 'galleryThreeAlt', 'processEyebrow', 'processHeadline'];
  const body = { ...Object.fromEntries(fields.map(k => [k, 'Synthetic'])), ...existing, principles: [{ title: 'Synthetic', copy: 'Synthetic' }], process: [{ title: 'Synthetic', copy: 'Synthetic' }] };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getAdminSession: async () => ({ workspaceId: 'a', userId: 'ua', role: 'EDITOR', sessionVersion: 1 }) },
    '@/lib/prisma': { prisma: { ...tx, $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if (inspected && change === 'actor') throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => true },
    '@/lib/workspace-singleton': { getWorkspaceSingletonTarget: async () => ({ where: { workspaceId: 'a' }, createIdentity: { id: 'workspace:a', workspaceId: 'a' } }) },
    '@/lib/r2-upload': { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    '@/lib/about-page': { defaultAboutPageContent: {} }, '@/lib/workspace-brand-storage': policy,
    '@/lib/workspace-brand-assets': { verifyRegisteredBrandImage: async () => { inspected = true; }, lockRegisteredBrandImage: async () => { if (change === 'asset') throw new Error('INVALID_BRAND_IMAGE'); } },
  };
  const exports: { PATCH?: (r: Request) => Promise<Response> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../app/api/admin/about/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, URL, Date, console: { error() {} }, require: (name: string) => { if (!(name in modules)) throw new Error(name); return modules[name]; },
  });
  return { writes: () => writes, call: () => exports.PATCH!(new Request('https://example.test/api', { method: 'PATCH', body: JSON.stringify(body) })) };
}
for (const [change, expected] of [['actor', 403], ['asset', 400], ['image', 409]] as const) test(`About save rechecks ${change} after image inspection`, async () => {
  const f = fixture(change); assert.equal((await f.call()).status, expected); assert.equal(f.writes(), 0);
});
test('About save preserves owned content and retained-image response', async () => {
  const f = fixture('none'); const response = await f.call(); assert.equal(response.status, 200); assert.equal((await response.json()).storageCleanupPending, false); assert.equal(f.writes(), 1);
});
