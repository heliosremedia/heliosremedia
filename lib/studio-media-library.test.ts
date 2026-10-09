import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function fixture() {
  let workspaceId = 'a', authenticated = true, found = true, reads = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const scope = (where: { project?: { workspaceId: string }; workspaceId?: string }) => {
    reads++; assert.equal(where.project?.workspaceId ?? where.workspaceId, workspaceId);
  };
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': {}, './MediaLibraryGrid': {},
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); } },
    '@/lib/auth/session': { requireAdminSession: async () => { if (!authenticated) throw new Error('LOGIN'); return { workspaceId }; } },
    '@/lib/media-collections': { MEDIA_COLLECTIONS: [], isMediaCategory: () => false, getMediaCollection: () => ({ label: 'Photography' }) },
    '@/lib/r2-upload': { getPublicAssetUrl: () => { throw new Error('Unexpected asset URL'); } },
    '@/lib/social/publishing-payload': { publishingStorageReferenceMatches: () => false },
    '@/lib/prisma': { prisma: {
      media: { count: async ({ where }: { where: Parameters<typeof scope>[0] }) => { scope(where); return 0; }, findMany: async ({ where }: { where: Parameters<typeof scope>[0] }) => { scope(where); return []; } },
      project: { count: async ({ where }: { where: Parameters<typeof scope>[0] }) => { scope(where); return 0; }, findFirst: async ({ where }: { where: Parameters<typeof scope>[0] }) => { scope(where); return found ? { id: 'owned', title: 'Owned project' } : null; } },
    } },
  };
  const exports = {} as { default: (p: { searchParams: Promise<Record<string, string>> }) => Promise<unknown> };
  runInNewContext(ts.transpileModule(readFileSync(new URL('../app/admin/media/page.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; }, URLSearchParams, Intl });
  return { call: (params = {}) => exports.default({ searchParams: Promise.resolve(params) }), owner: (id: string) => { workspaceId = id; }, logout: () => { authenticated = false; }, missing: () => { found = false; }, reads: () => reads };
}

test('media library scopes every count, list and project lookup to a fresh session under search and forged selectors', async () => {
  const h = fixture();
  for (const id of ['a', 'b', 'a']) { h.owner(id); await h.call({ search: 'foreign', project: 'owned', workspaceId: 'forged', visibility: 'HIDDEN' }); }
  const before = h.reads(); h.logout(); await assert.rejects(h.call(), /LOGIN/); assert.equal(h.reads(), before);
});

test('foreign and missing project filters stop before querying media; empty workspace offers creation', async () => {
  const h = fixture();
  assert.ok(JSON.stringify(await h.call()).includes('Create a project'));
  h.missing(); const before = h.reads(); await assert.rejects(h.call({ project: 'foreign' }), /NOT_FOUND/); assert.equal(h.reads(), before + 1);
});
