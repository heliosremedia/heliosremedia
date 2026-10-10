import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture(revokedAfterSession: boolean) {
  let revoked = false, deletes = 0;
  const tx = { $queryRaw: async () => [], teamMember: {
    findFirst: async () => ({ id: 'owned', portraitStorageKey: 'unverified-legacy.webp' }),
    delete: async () => { deletes++; return { id: 'owned', portraitStorageKey: 'unverified-legacy.webp' }; },
    deleteMany: async ({ where }: { where: { id: string; workspaceId: string } }) => { assert.equal(where.id, 'owned'); assert.equal(where.workspaceId, 'a'); deletes++; return { count: 1 }; },
  } };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getAdminSession: async () => { revoked = revokedAfterSession; return { workspaceId: 'a', userId: 'ua', role: 'EDITOR', sessionVersion: 1 }; } },
    '@/lib/prisma': { prisma: { ...tx, $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } },
    '@/lib/blog-ownership': { getContentOwnershipScope: async () => ({ workspaceId: 'a' }) },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if (revoked) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => true },
    '@/lib/workspace-brand-storage': { brandImageCleanupPending: (key: string) => Boolean(key) },
    '@/lib/team-members': { teamMemberCategories: ['PRODUCTION'], teamMemberSelect: {} }, '@/lib/r2-upload': {}, '@/lib/workspace-brand-assets': {},
  };
  const exports: { DELETE?: (r: Request) => Promise<Response> } = {};
  const source = readFileSync(new URL('../app/api/admin/team-members/route.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, URL, console: { error() {} }, require: (name: string) => { if (!(name in modules)) throw new Error(`Unexpected ${name}`); return modules[name]; },
  });
  return { deletes: () => deletes, call: () => exports.DELETE!(new Request('https://example.test/api/admin/team-members?teamMemberId=owned', { method: 'DELETE' })) };
}
test('team member deletion rechecks a session whose editor access has been revoked', async () => {
  const f = fixture(true); assert.equal((await f.call()).status, 403); assert.equal(f.deletes(), 0);
});
test('owned team member deletion retains uncertain storage and its response contract', async () => {
  const f = fixture(false); const response = await f.call(); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, deletedTeamMemberId: 'owned', storageCleanupPending: true }); assert.equal(f.deletes(), 1);
});
