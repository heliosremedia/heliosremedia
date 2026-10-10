import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyStudioProjectPublishing(origin, driver) {
  const db = driver.prisma, cases = [], races = [];
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const auditBefore = await db.auditEvent.findMany({ orderBy: { id: 'asc' } });
  const projectsBefore = await db.project.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const serviceIds = ['studio-publishing-service-a', 'studio-publishing-service-b'];
  const extraIds = [];
  const ids = ['studio-publishing-a', 'studio-publishing-b'];
  const snapshot = () => db.project.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  const send = (id, target, body) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, `/api/admin/projects/${target}/workflow`, { method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' }, body });
  try {
    for (const id of ['a', 'b']) {
      await db.service.create({ data: { id: `studio-publishing-service-${id}`, workspaceId: id, slug: `studio-publishing-service-${id}`, name: 'Synthetic photography' } });
      await db.project.create({ data: { id: `studio-publishing-${id}`, workspaceId: id, slug: `studio-publishing-${id}`, title: `Retained ${id}`, shortDescription: 'Retain project content' } });
      await db.media.create({ data: { id: `studio-publishing-media-${id}`, projectId: `studio-publishing-${id}`, serviceId: `studio-publishing-service-${id}`, sourceType: 'UPLOADED_IMAGE', mediaCategory: 'PHOTOGRAPHY', storageKey: 'synthetic/never-requested.jpg' } });
      await db.project.update({ where: { id: `studio-publishing-${id}` }, data: { heroMediaId: `studio-publishing-media-${id}` } });
      await db.projectService.create({ data: { projectId: `studio-publishing-${id}`, serviceId: `studio-publishing-service-${id}` } });
    }
    for (const id of ['a', 'b']) for (const action of ['publish', 'set-featured']) {
      const projectId = `studio-publishing-${id}`, other = id === 'a' ? 'b' : 'a';
      const row = await db.project.update({ where: { id: projectId }, data: { status: action === 'publish' ? 'DRAFT' : 'PUBLISHED', featured: false, publishedAt: action === 'publish' ? null : new Date('2026-01-01T00:00:00Z'), archivedAt: null } });
      const body = { action, expectedUpdatedAt: row.updatedAt.toISOString(), expectedStatus: row.status, featuredDuration: 'ALWAYS' };
      const before = await snapshot();
      for (const [target, patch, status] of [[`studio-publishing-${other}`, body, 404], [projectId, { ...body, expectedUpdatedAt: null }, 409], [projectId, { ...body, expectedStatus: 'ARCHIVED' }, 409]]) {
        assert.equal((await send(id, target, patch)).status, status); assert.deepEqual(await snapshot(), before);
      }
      for (const change of ['editor', 'revoked', 'suspended', 'project-owner', ...(action === 'publish' ? ['hidden-media', 'inactive-service', 'foreign-service'] : [])]) {
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
            if (change === 'hidden-media') await tx.media.update({ where: { id: `studio-publishing-media-${id}` }, data: { visibility: 'HIDDEN' } });
            else if (change === 'inactive-service') await tx.service.update({ where: { id: `studio-publishing-service-${id}` }, data: { active: false } });
            else if (change === 'foreign-service') await tx.service.update({ where: { id: `studio-publishing-service-${id}` }, data: { workspaceId: other } });
            else if (change === 'project-owner') await tx.project.update({ where: { id: projectId }, data: { workspaceId: other } });
            else if (change === 'suspended') await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
            else await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: change === 'editor' ? { role: 'EDITOR' } : { status: 'REVOKED' } });
          }, { timeout: 15000 });
          const afterChange = await snapshot();
          const reply = await pending; assert.equal(reply.error, undefined); assert.equal(reply.value.status, change === 'project-owner' ? 404 : ['hidden-media', 'inactive-service', 'foreign-service'].includes(change) ? 409 : 403);
          assert.deepEqual(await snapshot(), afterChange);
          if (change !== 'project-owner') assert.deepEqual(afterChange, before);
          else { const moved = afterChange.find(p => p.id === projectId); assert.equal(moved.status, row.status); assert.equal(moved.featured, row.featured); assert.deepEqual(moved.publishedAt, row.publishedAt); }
          races.push({ tenant: id, action, change, databaseWaitObserved: true, deniedStatusWriteUnchanged: true });
        } finally {
          await pending;
          await db.project.update({ where: { id: projectId }, data: row });
          await db.media.update({ where: { id: `studio-publishing-media-${id}` }, data: { visibility: 'VISIBLE' } });
          await db.service.update({ where: { id: `studio-publishing-service-${id}` }, data: { active: true, workspaceId: id } });
          const member = memberships.find(m => m.workspaceId === id); await db.workspaceMembership.update({ where: { id: member.id }, data: member });
          const workspace = workspaces.find(w => w.id === id); await db.workspace.update({ where: { id }, data: { lifecycleState: workspace.lifecycleState, updatedAt: workspace.updatedAt } });
        }
      }
      const replies = await Promise.all([send(id, projectId, body), send(id, projectId, body)]);
      assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 409]);
      const receipt = JSON.parse(replies.find(reply => reply.status === 200).text);
      const saved = await db.project.findUniqueOrThrow({ where: { id: projectId } });
      assert.equal(saved.status, 'PUBLISHED'); assert.equal(saved.featured, action === 'set-featured'); assert.ok(saved.publishedAt);
      assert.equal(saved.archivedAt, null); assert.equal(saved.title, row.title); assert.equal(saved.shortDescription, row.shortDescription); assert.ok(saved.updatedAt > row.updatedAt);
      assert.equal(receipt.updatedAt, saved.updatedAt.toISOString()); assert.equal(receipt.project.id, projectId); assert.equal(receipt.project.status, saved.status);
      const after = await snapshot(); assert.equal((await send(id, projectId, body)).status, 409); assert.deepEqual(await snapshot(), after);
      assert.deepEqual(after.find(p => p.id === `studio-publishing-${other}`), before.find(p => p.id === `studio-publishing-${other}`));
      cases.push({ tenant: id, action, foreignDenied: true, missingRevisionAndWrongStatusDenied: true, concurrentSingleWinner: true, staleReplayUnchanged: true, contentRetained: true, otherWorkspaceUnchanged: true, publicationAndPlacementConfirmed: true });
    }
    // A stale flag must not bypass capacity; two contenders for the last slot have one winner.
    for (const id of ['a', 'b']) {
      const active = () => db.project.count({ where: { workspaceId: id, status: 'PUBLISHED', featured: true, OR: [{ featuredExpiresAt: null }, { featuredExpiresAt: { gt: new Date() } }] } });
      const baseline = await active(); assert.ok(baseline <= 5);
      for (let n = baseline; n < 5; n++) {
        const key = `studio-publishing-cap-${id}-${n}`; extraIds.push(key);
        await db.project.create({ data: { id: key, workspaceId: id, slug: key, title: key, status: 'PUBLISHED', featured: true } });
      }
      const contenders = [];
      for (let n = 0; n < 2; n++) {
        const key = `studio-publishing-contender-${id}-${n}`; extraIds.push(key);
        contenders.push(await db.project.create({ data: { id: key, workspaceId: id, slug: key, title: key, status: 'PUBLISHED', publishedAt: new Date(), featured: true, featuredExpiresAt: new Date('2020-01-01') } }));
      }
      const replies = await Promise.all(contenders.map(row => send(id, row.id, { action: 'set-featured', featuredDuration: 'ALWAYS', expectedUpdatedAt: row.updatedAt.toISOString(), expectedStatus: row.status })));
      assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]); assert.equal(await active(), 6);
      const loser = contenders[replies.findIndex(r => r.status === 409)];
      assert.deepEqual(await db.project.findUnique({ where: { id: loser.id } }), loser);
      const selected = (await db.project.findMany({ where: { workspaceId: id, status: 'PUBLISHED', featured: true, OR: [{ featuredExpiresAt: null }, { featuredExpiresAt: { gt: new Date() } }] }, orderBy: { id: 'asc' } })).map(p => p.id);
      const finalize = projectIds => http(origin, `${id}.example.test`, '/api/admin/projects/featured', { method: 'PATCH', headers: { cookie: driver.cookie(id) }, body: { projectIds } });
      // Finalization and renewal serialize through the same workspace lock.
      const competing = await Promise.all([finalize(selected), send(id, loser.id, { action: 'set-featured', featuredDuration: 'ALWAYS', expectedUpdatedAt: loser.updatedAt.toISOString(), expectedStatus: loser.status })]);
      assert.equal(competing[0].status, 200); assert.equal(competing[1].status, 409); assert.equal(await active(), 6);
      const finalState = await db.project.findMany({ orderBy: { id: 'asc' } });
      assert.equal((await finalize([`studio-publishing-${id === 'a' ? 'b' : 'a'}`])).status, 409);
      const member = memberships.find(m => m.workspaceId === id);
      try {
        await db.workspaceMembership.update({ where: { id: member.id }, data: { role: 'EDITOR' } });
        assert.equal((await finalize([])).status, 403);
      } finally { await db.workspaceMembership.update({ where: { id: member.id }, data: member }); }
      assert.deepEqual(await db.project.findMany({ orderBy: { id: 'asc' } }), finalState);
      cases.push({ tenant: id, expiredRenewalConsumesSlot: true, concurrentLastSlotSingleWinner: true, listWriterConcurrentLimitPreserved: true, listWriterForeignAndEditorDenied: true, limit: 6 });
    }
    return { cases, races, actualNextHttp: true, liveProviderCalls: false, scope: 'reviewed project publishing and placement; featured list review remains a separate UI dependency' };

  } finally {
    await db.project.updateMany({ where: { id: { in: ids } }, data: { heroMediaId: null } });
    await db.project.deleteMany({ where: { id: { in: [...ids, ...extraIds] } } });
    await db.service.deleteMany({ where: { id: { in: serviceIds } } });
    await db.auditEvent.deleteMany({ where: { action: 'FEATURED_PROJECTS_FINALIZED', id: { notIn: auditBefore.map(row => row.id) } } });
    for (const row of projectsBefore) await db.project.update({ where: { id: row.id }, data: row });
    assert.deepEqual(await db.project.findMany({ orderBy: { id: 'asc' } }), projectsBefore);
    assert.deepEqual(await db.auditEvent.findMany({ orderBy: { id: 'asc' } }), auditBefore);
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: { lifecycleState: row.lifecycleState, lifecycleRevision: row.lifecycleRevision, lastReactivatedAt: row.lastReactivatedAt, updatedAt: row.updatedAt } });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
