import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyStudioProjectEditor(origin, driver) {
  const db = driver.prisma, cases = [], races = [];
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const ids = ['studio-editor-a', 'studio-editor-b'];
  const snapshot = () => db.project.findMany({ where: { id: { in: ids } }, include: { details: true, agents: true }, orderBy: { id: 'asc' } });
  const send = (id, projectId, body) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, `/api/admin/projects/${projectId}/details`, { method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' }, body });
  try {
    for (const id of ['a', 'b']) await db.project.create({ data: { id: `studio-editor-${id}`, workspaceId: id, slug: `studio-editor-${id}`, title: `Editor ${id}`, status: 'DRAFT' } });
    for (const id of ['a', 'b']) {
      const projectId = `studio-editor-${id}`, other = id === 'a' ? 'b' : 'a';
      const row = await db.project.findUniqueOrThrow({ where: { id: projectId } });
      const body = { title: `Updated editor ${id}`, slug: row.slug, expectedUpdatedAt: row.updatedAt.toISOString(), propertyAddress: `Internal ${id}`, agents: [{ clientId: null, displayNameSnapshot: `Agent ${id}`, brokerageSnapshot: 'Synthetic' }] };
      const before = await snapshot();
      assert.equal((await send(id, `studio-editor-${other}`, body)).status, 404);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await send(id, projectId, { ...body, expectedUpdatedAt: null })).status, 409);
      assert.deepEqual(await snapshot(), before);
      for (const change of ['viewer', 'revoked', 'suspended']) {
        let pending;
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = send(id, projectId, body).then(value => ({ value }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              const blocked = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;
              if (blocked.length) { observed = true; break; } await delay(25);
            }
            assert.equal(observed, true, change);
            if (change === 'suspended') await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
            else await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: change === 'viewer' ? { role: 'VIEWER' } : { status: 'REVOKED' } });
          }, { timeout: 15000 });
          const reply = await pending; assert.equal(reply.error, undefined); assert.equal(reply.value.status, 403);
          assert.deepEqual(await snapshot(), before);
          races.push({ tenant: id, change, databaseWaitObserved: true, status: 403, projectDetailsAndAgentsUnchanged: true });
        } finally {
          await pending;
          const member = memberships.find(row => row.workspaceId === id);
          await db.workspaceMembership.update({ where: { id: member.id }, data: member });
          const workspace = workspaces.find(row => row.id === id);
          await db.workspace.update({ where: { id }, data: { lifecycleState: workspace.lifecycleState, updatedAt: workspace.updatedAt } });
        }
      }
      const replies = await Promise.all([send(id, projectId, body), send(id, projectId, { ...body, title: `Concurrent ${id}` })]);
      assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 409]);
      const saved = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { details: true, agents: true } });
      assert.ok(saved.updatedAt > row.updatedAt); assert.equal(saved.details.propertyAddress, body.propertyAddress); assert.equal(saved.agents.length, 1);
      const after = await snapshot();
      assert.equal((await send(id, projectId, body)).status, 409); assert.deepEqual(await snapshot(), after);
      assert.deepEqual(after.find(row => row.workspaceId === other), before.find(row => row.workspaceId === other));
      const second = await send(id, projectId, { ...body, expectedUpdatedAt: saved.updatedAt.toISOString(), title: `Reviewed again ${id}` });
      assert.equal(second.status, 200); assert.equal(JSON.parse(second.text).project.title, `Reviewed again ${id}`);
      cases.push({ tenant: id, foreign404: true, missingRevision409: true, concurrentOneSuccessOneConflict: true, staleReplay409: true, reviewedSecondEdit200: true, otherWorkspaceUnchanged: true });
    }
    return { cases, races, actualNextHttp: true, providerCalls: false, scope: 'project details and agent snapshot edits only' };
  } finally {
    await db.projectAgent.deleteMany({ where: { projectId: { in: ids } } });
    await db.projectDetails.deleteMany({ where: { projectId: { in: ids } } });
    await db.project.deleteMany({ where: { id: { in: ids } } });
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: { lifecycleState: row.lifecycleState, lifecycleRevision: row.lifecycleRevision, lastReactivatedAt: row.lastReactivatedAt, updatedAt: row.updatedAt } });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
