import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { studioEnabledFor } from './studio-access.ts';
import { studioLinkIsActive, studioNavigation } from './studio-navigation.ts';

test('Studio rollout requires tenant mode, explicit enablement, exact workspace allowlist and administrator role', () => {
  const names = ['STUDIO_V2_TENANT_CONTEXT_ENABLED', 'STUDIO_V2_SHELL_ENABLED', 'STUDIO_V2_SHELL_WORKSPACE_IDS'];
  const previous = names.map(name => process.env[name]);
  try {
    for (const name of names) delete process.env[name];
    const owner = { role: 'OWNER' as const, workspaceId: 'a' };
    assert.equal(studioEnabledFor(owner), false);
    process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = 'true';
    process.env.STUDIO_V2_SHELL_ENABLED = 'true';
    assert.equal(studioEnabledFor(owner), false);
    process.env.STUDIO_V2_SHELL_WORKSPACE_IDS = ' a, b ';
    assert.equal(studioEnabledFor(owner), true);
    assert.equal(studioEnabledFor({ role: 'ADMIN', workspaceId: 'b' }), true);
    for (const role of ['EDITOR', 'VIEWER'] as const) assert.equal(studioEnabledFor({ role, workspaceId: 'a' }), false);
    assert.equal(studioEnabledFor({ ...owner, workspaceId: 'ab' }), false);
    process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = 'false';
    assert.equal(studioEnabledFor(owner), false);
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});

test('overview binds every read to the current session and denies access before querying data', async () => {
  let workspaceId = 'a', allowed = true, revoked = false;
  const reads: string[] = [];
  const modules: Record<string, unknown> = {
    'server-only': {}, 'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); } },
    './auth/session': { requireAdminSession: async () => { if (revoked) throw new Error('LOGIN'); return { workspaceId, role: 'OWNER' }; } },
    './studio-access': { studioEnabledFor: () => allowed },
    './dashboard': { getDashboardData: async (id: string) => { reads.push(id); return { generatedAt: new Date(), operations: { owner: id }, website: { owner: id }, secret: 'not projected' }; } },
  };
  const exports = {} as { getStudioOverview: () => Promise<{ operations: { owner: string }; website: { owner: string }; secret?: string }> };
  runInNewContext(ts.transpileModule(readFileSync(new URL('./studio-overview.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  for (const id of ['a', 'b', 'a']) {
    workspaceId = id;
    const data = await exports.getStudioOverview();
    assert.equal(data.operations.owner, id); assert.equal(data.website.owner, id); assert.equal(data.secret, undefined);
  }
  allowed = false; await assert.rejects(exports.getStudioOverview(), /NOT_FOUND/);
  allowed = true; revoked = true; await assert.rejects(exports.getStudioOverview(), /LOGIN/);
  assert.deepEqual(reads, ['a', 'b', 'a']);
});

test('Studio navigation has valid existing pages and exactly one active destination for nested modules', () => {
  for (const group of studioNavigation) for (const link of group.links) assert.ok(readFileSync(`app${link.href}/page.tsx`, 'utf8'), link.href);
  for (const path of ['/admin', '/admin/studio', '/admin/projects/p1', '/admin/social-studio/calendar', '/admin/social-studio/settings']) {
    const active = studioNavigation.flatMap(group => [...group.links]).filter(link => studioLinkIsActive(path, link.href));
    assert.equal(active.length, 1, path);
  }
  assert.equal(studioLinkIsActive('/admin/projects-foreign', '/admin/projects'), false);
});
