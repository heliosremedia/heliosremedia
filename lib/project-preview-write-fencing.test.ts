import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as membership from './workspace-membership-core.ts';

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, Date, URL, console: { error() {} }, require: (id: string) => {
    assert.ok(id in modules, `Unexpected module ${id}`); return modules[id];
  } });
  return exports as T;
}

for (const change of ['revoked', 'viewer', 'session-version', 'account-disabled', 'workspace-transfer', 'lookup-failure']) {
  test(`preview create/revoke fence a stale session after ${change} without mutation or audit`, async () => {
    let writes = 0; let audits = 0; const locks: string[] = [];
    const user = { id: 'ua', workspaceId: change === 'workspace-transfer' ? 'b' : 'a', active: change !== 'account-disabled', role: 'OWNER', sessionVersion: change === 'session-version' ? 2 : 1 };
    const tx = {
      $queryRaw: async (strings: TemplateStringsArray) => { locks.push(strings.join('?')); return [{ id: 'pa' }]; },
      adminUser: { findFirst: async ({ where }: { where: { workspaceId: string } }) => {
        if (change === 'lookup-failure') throw new Error('Synthetic database unavailable');
        return user.workspaceId === where.workspaceId ? user : null;
      } },
      workspaceMembership: { findUnique: async () => ({ userId: 'ua', workspaceId: 'a', role: change === 'viewer' ? 'VIEWER' : 'OWNER', status: change === 'revoked' ? 'REVOKED' : 'ACTIVE' }) },
      project: { findFirst: async () => ({ slug: 'synthetic', title: 'Synthetic' }) },
      projectPreviewLink: { create: async () => { writes++; return { id: 'preview' }; }, updateMany: async () => { writes++; return { count: 1 }; } },
    };
    const policy = load('./workspace-write-access.ts', {
      './workspace-context-core.ts': { tenantContextEnabled: () => true }, './workspace-membership-core.ts': membership,
    });
    type Route = (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response>;
    const route = load<Record<'POST' | 'DELETE', Route>>('../app/api/admin/projects/[projectId]/previews/route.ts', {
      'next/cache': { revalidatePath() {} }, 'next/server': { NextResponse: Response },
      '@/lib/auth/session': { getAdminSession: async () => ({ userId: 'ua', workspaceId: 'a', role: 'OWNER', sessionVersion: 1 }) },
      '@/lib/workspace-write-access': policy,
      '@/lib/prisma': { prisma: { $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx), projectPreviewLink: tx.projectPreviewLink } },
      '@/lib/audit': { recordAuditEvent: async () => { audits++; } },
      '@/lib/project-preview': { createPreviewToken: () => 'synthetic', hashPreviewToken: () => 'synthetic-hash' },
      '@/lib/project-preview-url': { getWorkspacePreviewUrl: async () => 'https://a.example.test/portfolio/synthetic' },
    });
    for (const method of ['POST', 'DELETE'] as const) {
      const result = await route[method](new Request('http://localhost/api?previewId=preview', { method, ...(method === 'POST' ? { body: JSON.stringify({ days: 1 }) } : {}) }), { params: Promise.resolve({ projectId: 'pa' }) });
      assert.equal(result.status, change === 'lookup-failure' ? 500 : 403);
    }
    assert.equal(writes, 0); assert.equal(audits, 0);
    assert.equal(locks.length, 6);
    for (let i = 0; i < locks.length; i += 3) {
      assert.match(locks[i], /FROM "Workspace"/); assert.match(locks[i + 1], /FROM "AdminUser"/); assert.match(locks[i + 2], /FROM "WorkspaceMembership"/);
    }
  });
}
