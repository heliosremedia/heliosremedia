import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyStudioPrivateStatus(origin, driver) {
  const db = driver.prisma, cases = [], races = [];
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const ids = ['studio-status-a', 'studio-status-b'];
  const snapshot = () => db.project.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  const send = (id, target, body) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, `/api/admin/projects/${target}/workflow`, { method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' }, body });
  try {
    for (const id of ['a', 'b']) await db.project.create({ data: { id: `studio-status-${id}`, workspaceId: id, slug: `studio-status-${id}`, title: `Retained ${id}`, shortDescription: 'Retain project content', status: 'PUBLISHED', featured: true, publishedAt: new Date('2026-01-01T00:00:00Z') } });
    for (const id of ['a', 'b']) for (const [action, sourceStatus] of [['unpublish', 'PUBLISHED'], ['archive', 'PUBLISHED'], ['unpublish', 'ARCHIVED']]) {
      const projectId = `studio-status-${id}`, other = id === 'a' ? 'b' : 'a';
      const row = await db.project.update({ where: { id: projectId }, data: { status: sourceStatus, featured: sourceStatus === 'PUBLISHED', publishedAt: sourceStatus === 'PUBLISHED' ? new Date('2026-01-01T00:00:00Z') : null, archivedAt: sourceStatus === 'ARCHIVED' ? new Date('2026-01-02T00:00:00Z') : null } });
      const body = { action, expectedUpdatedAt: row.updatedAt.toISOString(), expectedStatus: sourceStatus };
      const before = await snapshot();
      for (const [target, patch, status] of [[`studio-status-${other}`, body, 404], [projectId, { ...body, expectedUpdatedAt: null }, 409], [projectId, { ...body, expectedStatus: 'DRAFT' }, 409]]) {
        assert.equal((await send(id, target, patch)).status, status); assert.deepEqual(await snapshot(), before);
      }
      for (const change of ['editor', 'revoked', 'suspended', 'project-owner']) {
        let pending;
        try {
          await db.$transaction(async tx => {
            if (change === 'project-owner') await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId} FOR UPDATE`;
            else await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = send(id, projectId, body).then(value => ({ value }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              if ((await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`).length) { observed = true; break; }
              await delay(25);
            }
            assert.equal(observed, true, change);
            if (change === 'project-owner') await tx.project.update({ where: { id: projectId }, data: { workspaceId: other } });
            else if (change === 'suspended') await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
            else await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: change === 'editor' ? { role: 'EDITOR' } : { status: 'REVOKED' } });
          }, { timeout: 15000 });
          const afterChange = await snapshot();
          const reply = await pending; assert.equal(reply.error, undefined); assert.equal(reply.value.status, change === 'project-owner' ? 404 : 403);
          assert.deepEqual(await snapshot(), afterChange);
          if (change !== 'project-owner') assert.deepEqual(afterChange, before);
          else { const moved = afterChange.find(p => p.id === projectId); assert.equal(moved.status, sourceStatus); assert.equal(moved.featured, row.featured); assert.deepEqual(moved.publishedAt, row.publishedAt); }
          races.push({ tenant: id, action, sourceStatus, change, databaseWaitObserved: true, deniedStatusWriteUnchanged: true });
        } finally {
          await pending;
          await db.project.update({ where: { id: projectId }, data: row });
          const member = memberships.find(m => m.workspaceId === id); await db.workspaceMembership.update({ where: { id: member.id }, data: member });
          const workspace = workspaces.find(w => w.id === id); await db.workspace.update({ where: { id }, data: { lifecycleState: workspace.lifecycleState, updatedAt: workspace.updatedAt } });
        }
      }
      const replies = await Promise.all([send(id, projectId, body), send(id, projectId, body)]);
      assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 409]);
      const receipt = JSON.parse(replies.find(reply => reply.status === 200).text);
      const saved = await db.project.findUniqueOrThrow({ where: { id: projectId } });
      assert.equal(saved.status, action === 'archive' ? 'ARCHIVED' : 'DRAFT'); assert.equal(saved.featured, false); assert.equal(saved.publishedAt, null);
      assert.equal(Boolean(saved.archivedAt), action === 'archive'); assert.equal(saved.title, row.title); assert.equal(saved.shortDescription, row.shortDescription); assert.ok(saved.updatedAt > row.updatedAt);
      assert.equal(receipt.updatedAt, saved.updatedAt.toISOString()); assert.equal(receipt.project.id, projectId); assert.equal(receipt.project.status, saved.status);
      const after = await snapshot(); assert.equal((await send(id, projectId, body)).status, 409); assert.deepEqual(await snapshot(), after);
      assert.deepEqual(after.find(p => p.id === `studio-status-${other}`), before.find(p => p.id === `studio-status-${other}`));
      cases.push({ tenant: id, action, sourceStatus, foreignDenied: true, missingRevisionAndWrongStatusDenied: true, concurrentSingleWinner: true, staleReplayUnchanged: true, contentRetained: true, otherWorkspaceUnchanged: true, unpublishedAndUnfeatured: true });
    }
    return { cases, races, actualNextHttp: true, liveProviderCalls: false, scope: 'reviewed unpublish/archive and private draft restoration; publish and featured writers remain separate dependencies' };
  } finally {
    await db.project.deleteMany({ where: { id: { in: ids } } });
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: { lifecycleState: row.lifecycleState, lifecycleRevision: row.lifecycleRevision, lastReactivatedAt: row.lastReactivatedAt, updatedAt: row.updatedAt } });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
