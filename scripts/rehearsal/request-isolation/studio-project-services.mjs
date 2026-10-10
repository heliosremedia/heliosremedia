import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyStudioProjectServices(origin, driver) {
  const db = driver.prisma, cases = [], races = [];
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const ids = ['studio-services-a', 'studio-services-b'];
  const snapshot = () => db.project.findMany({ where: { id: { in: ids } }, include: { services: { orderBy: { serviceId: 'asc' } } }, orderBy: { id: 'asc' } });
  const send = (id, projectId, body) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, `/api/admin/projects/${projectId}/workflow`, { method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' }, body: { action: 'assign-services', ...body } });
  try {
    for (const id of ['a', 'b']) {
      await db.project.create({ data: { id: `studio-services-${id}`, workspaceId: id, slug: `studio-services-${id}`, title: `Services ${id}`, status: 'DRAFT' } });
      await db.service.create({ data: { id: `studio-service-${id}`, workspaceId: id, slug: 'studio-services-test', name: `Service ${id}`, active: true } });
    }
    for (const id of ['a', 'b']) {
      const projectId = `studio-services-${id}`, serviceId = `studio-service-${id}`, other = id === 'a' ? 'b' : 'a';
      const row = await db.project.findUniqueOrThrow({ where: { id: projectId } });
      const body = { expectedServiceIds: [], serviceIds: [serviceId], expectedUpdatedAt: row.updatedAt.toISOString() };
      const before = await snapshot();
      for (const [target, patch, status] of [
        [`studio-services-${other}`, body, 404], [projectId, { ...body, expectedUpdatedAt: null }, 409],
        [projectId, { ...body, serviceIds: [`studio-service-${other}`] }, 409],
        [projectId, { ...body, serviceIds: [serviceId, serviceId] }, 400],
      ]) { assert.equal((await send(id, target, patch)).status, status); assert.deepEqual(await snapshot(), before); }
      for (const change of ['editor', 'revoked', 'suspended', 'service-archived', 'service-inactive', 'service-owner']) {
        let pending;
        const service = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
        try {
          await db.$transaction(async tx => {
            if (change.startsWith('service-')) await tx.$queryRaw`SELECT id FROM "Service" WHERE id=${serviceId} FOR UPDATE`;
            else await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = send(id, projectId, body).then(value => ({ value }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              if ((await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`).length) { observed = true; break; }
              await delay(25);
            }
            assert.equal(observed, true, change);
            if (change === 'suspended') await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
            else if (change.startsWith('service-')) await tx.service.update({ where: { id: serviceId }, data: change === 'service-archived' ? { archivedAt: new Date() } : change === 'service-inactive' ? { active: false } : { workspaceId: other, slug: `moved-service-${id}` } });
            else await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: change === 'editor' ? { role: 'EDITOR' } : { status: 'REVOKED' } });
          }, { timeout: 15000 });
          const reply = await pending; assert.equal(reply.error, undefined); assert.equal(reply.value.status, change.startsWith('service-') ? 409 : 403);
          assert.deepEqual(await snapshot(), before);
          races.push({ tenant: id, change, databaseWaitObserved: true, selectionAndRevisionUnchanged: true });
        } finally {
          await pending;
          await db.service.update({ where: { id: serviceId }, data: service });
          const member = memberships.find(row => row.workspaceId === id);
          await db.workspaceMembership.update({ where: { id: member.id }, data: member });
          const workspace = workspaces.find(row => row.id === id);
          await db.workspace.update({ where: { id }, data: { lifecycleState: workspace.lifecycleState, updatedAt: workspace.updatedAt } });
        }
      }
      await db.projectService.create({ data: { projectId, serviceId } });
      const mediaAssignment = await snapshot();
      assert.equal((await send(id, projectId, { ...body, serviceIds: [] })).status, 409);
      assert.deepEqual(await snapshot(), mediaAssignment, 'An assignment added by media cannot be lost with an unchanged project revision');
      await db.projectService.deleteMany({ where: { projectId } });
      const replies = await Promise.all([send(id, projectId, body), send(id, projectId, body)]);
      assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 409]);
      const saved = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { services: true } });
      assert.ok(saved.updatedAt > row.updatedAt); assert.equal(saved.services.length, 1); assert.equal(saved.services[0].serviceId, serviceId);
      const after = await snapshot();
      assert.equal((await send(id, projectId, body)).status, 409); assert.deepEqual(await snapshot(), after);
      assert.deepEqual(after.find(row => row.workspaceId === other), before.find(row => row.workspaceId === other));
      await db.service.update({ where: { id: serviceId }, data: { active: false } });
      const retained = await send(id, projectId, { ...body, expectedServiceIds: [serviceId], expectedUpdatedAt: saved.updatedAt.toISOString() });
      assert.equal(retained.status, 200, 'Previously assigned inactive service may be retained');
      const cleared = await send(id, projectId, { serviceIds: [], expectedServiceIds: [serviceId], expectedUpdatedAt: JSON.parse(retained.text).updatedAt });
      assert.equal(cleared.status, 200); assert.equal((await db.projectService.count({ where: { projectId } })), 0);
      cases.push({ tenant: id, foreignProjectAndServiceDenied: true, missingRevisionDenied: true, duplicateSelectionDenied: true, concurrentSingleWinner: true, staleReplayUnchanged: true, otherWorkspaceUnchanged: true, inactiveRetained: true, reviewedClear: true, mediaAssignmentPreserved: true });
    }
    return { cases, races, actualNextHttp: true, providerCalls: false, scope: 'private project service assignment; publishing actions not qualified here' };
  } finally {
    await db.projectService.deleteMany({ where: { projectId: { in: ids } } });
    await db.project.deleteMany({ where: { id: { in: ids } } });
    await db.service.deleteMany({ where: { id: { in: ['studio-service-a', 'studio-service-b'] } } });
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: { lifecycleState: row.lifecycleState, lifecycleRevision: row.lifecycleRevision, lastReactivatedAt: row.lastReactivatedAt, updatedAt: row.updatedAt } });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
