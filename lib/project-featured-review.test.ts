import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';
import { isActivelyFeatured } from './featured-project.ts';

function fixture() {
  const state = { title: 'Reviewed project', order: ['p1'], event: 'audit1', expires: new Date('2026-10-11T00:00:00Z') };
  const tx = {
    project: { findMany: async ({ where }: { where: { workspaceId: string } }) => {
      assert.equal(where.workspaceId, 'a');
      return [{ id: 'p1', title: state.title, slug: 'project', status: 'PUBLISHED', featured: true, featuredStartedAt: new Date('2026-10-01'), featuredExpiresAt: state.expires, updatedAt: new Date('2026-10-01'), displayOrder: 0 }];
    } },
    auditEvent: { findFirst: async ({ where }: { where: { workspaceId: string; entityId: string } }) => {
      assert.equal(where.workspaceId, 'a'); assert.equal(where.entityId, 'a'); return { id: state.event, metadata: { projectIds: state.order } };
    } },
  };
  const exports = {} as { readFeaturedProjectReview: (tx: unknown, workspaceId: string, now: Date) => Promise<{ revision: string; activeIds: string[]; order: string[] }> };
  const modules: Record<string, unknown> = {
    'server-only': {}, 'node:crypto': { createHash }, '@/lib/prisma': {}, '@/lib/featured-project': { isActivelyFeatured },
    '@/lib/blog-ownership': { getContentOwnershipScope: async (workspaceId: string, client: unknown) => { assert.equal(client, tx); return { workspaceId }; } },
  };
  runInNewContext(ts.transpileModule(readFileSync('lib/project-featured-review.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return { state, read: (now = new Date('2026-10-10')) => exports.readFeaturedProjectReview(tx, 'a', now) };
}

test('featured review is stable until a displayed placement actually expires', async () => {
  const f = fixture(); const initial = await f.read();
  assert.equal((await f.read(new Date('2026-10-10T23:59:59.999Z'))).revision, initial.revision);
  const expired = await f.read(new Date('2026-10-11T00:00:00Z'));
  assert.notEqual(expired.revision, initial.revision); assert.equal(expired.activeIds.length, 0);
});
test('changed project content invalidates the reviewed featured candidates', async () => {
  const f = fixture(); const before = await f.read(); f.state.title = 'A different project title';
  assert.notEqual((await f.read()).revision, before.revision);
});
test('a changed saved order invalidates review even when project fields are unchanged', async () => {
  const f = fixture(); const before = await f.read(); f.state.order = []; f.state.event = 'audit2';
  const changed = await f.read(); assert.notEqual(changed.revision, before.revision); assert.equal(changed.order.length, 0);
});
