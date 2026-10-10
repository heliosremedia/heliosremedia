import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyStudioFeaturedList(origin, driver) {
  const db = driver.prisma, cases = [], races = [], ids = [];
  const projectsBefore = await db.project.findMany({ orderBy: { id: 'asc' } });
  const auditBefore = await db.auditEvent.findMany({ orderBy: { id: 'asc' } });
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const snapshot = async () => ({ projects: await db.project.findMany({ orderBy: { id: 'asc' } }), audits: await db.auditEvent.findMany({ orderBy: { id: 'asc' } }) });
  const send = (id, body) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, '/api/admin/projects/featured', { method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' }, body });
  try {
    for (const id of ['a', 'b']) for (const n of [1, 2]) {
      const key = `studio-featured-list-${id}-${n}`; ids.push(key);
      await db.project.create({ data: { id: key, workspaceId: id, slug: key, title: key, status: 'PUBLISHED', publishedAt: new Date() } });
    }
    for (const id of ['a', 'b']) {
      const own = ids.filter(key => key.includes(`-${id}-`)), other = id === 'a' ? 'b' : 'a';
      let review = await driver.getFeaturedProjectReview(id);
      const page = await http(origin, `${other}.example.test`, '/admin/projects', { headers: { cookie: driver.cookie(id) } });
      assert.equal(page.status, 200); assert.ok(page.text.includes(review.revision)); assert.ok(page.text.includes(own[0])); assert.ok(!page.text.includes(`studio-featured-list-${other}-1`));
      const before = await snapshot();
      for (const [body, status] of [[{ projectIds: own }, 409], [{ expectedRevision: review.revision }, 400], [{ projectIds: [own[0], 123], expectedRevision: review.revision }, 400], [{ projectIds: [`studio-featured-list-${other}-1`], expectedRevision: review.revision }, 409]]) {
        assert.equal((await send(id, body)).status, status); assert.deepEqual(await snapshot(), before);
      }
      for (const change of ['editor', 'revoked', 'suspended', 'project-title']) {
        let pending;
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = send(id, { projectIds: own, expectedRevision: review.revision }).then(value => ({ value }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              if ((await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`).length) { observed = true; break; }
              await delay(25);
            }
            assert.equal(observed, true, change);
            if (change === 'project-title') await tx.project.update({ where: { id: own[0] }, data: { title: 'Changed after review' } });
            else if (change === 'suspended') await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
            else await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: change === 'editor' ? { role: 'EDITOR' } : { status: 'REVOKED' } });
          }, { timeout: 15000 });
          const changed = await snapshot(); const reply = await pending; assert.equal(reply.error, undefined); assert.equal(reply.value.status, change === 'project-title' ? 409 : 403); assert.deepEqual(await snapshot(), changed);
          races.push({ tenant: id, change, databaseWaitObserved: true, noUnreviewedWrite: true });
        } finally {
          await pending;
          const project = before.projects.find(p => p.id === own[0]); await db.project.update({ where: { id: project.id }, data: project });
          const member = memberships.find(m => m.workspaceId === id); await db.workspaceMembership.update({ where: { id: member.id }, data: member });
          const workspace = workspaces.find(w => w.id === id); await db.workspace.update({ where: { id }, data: { lifecycleState: workspace.lifecycleState, updatedAt: workspace.updatedAt } });
        }
      }
      const body = { projectIds: [...own].reverse(), expectedRevision: review.revision };
      const replies = await Promise.all([send(id, body), send(id, body)]); assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
      const receipt = JSON.parse(replies.find(r => r.status === 200).text); review = await driver.getFeaturedProjectReview(id);
      assert.equal(receipt.workspaceId, id); assert.equal(receipt.revision, review.revision); assert.notEqual(receipt.revision, body.expectedRevision); assert.deepEqual(receipt.projectIds, body.projectIds); assert.deepEqual(review.order, body.projectIds);
      const saved = await snapshot(); assert.equal((await send(id, body)).status, 409); assert.deepEqual(await snapshot(), saved);
      assert.deepEqual(saved.projects.filter(p => p.workspaceId === other), before.projects.filter(p => p.workspaceId === other));
      const empty = await send(id, { projectIds: [], expectedRevision: review.revision }); assert.equal(empty.status, 200);
      assert.equal((await driver.getFeaturedProjectReview(id)).activeIds.length, 0);
      cases.push({ tenant: id, scopedPageRevision: true, invalidAndForeignRejected: true, concurrentSingleWinner: true, orderedReceipt: true, staleReplayUnchanged: true, explicitEmptySelection: true, otherWorkspaceUnchanged: true });
    }
    return { cases, races, actualNextHttp: true, liveProviderCalls: false, cleanupVerified: true };
  } finally {
    await db.project.deleteMany({ where: { id: { in: ids } } });
    for (const row of projectsBefore) await db.project.update({ where: { id: row.id }, data: row });
    await db.auditEvent.deleteMany({ where: { action: 'FEATURED_PROJECTS_FINALIZED', id: { notIn: auditBefore.map(row => row.id) } } });
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: row });
    assert.deepEqual((await snapshot()), { projects: projectsBefore, audits: auditBefore });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
