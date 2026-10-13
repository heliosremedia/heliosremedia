import assert from 'node:assert/strict';
import { http } from './http.mjs';

export async function qualifyStudioJobReview(origin, driver) {
  const db = driver.prisma, cases = [], ids = ['studio-job-a', 'studio-job-b'];
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const read = id => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, '/api/admin/studio/newsletter-jobs?workspaceId=foreign', { headers: { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' } });
  try {
    for (const id of ['a', 'b']) {
      const key = `studio-job-${id}`, now = new Date();
      await db.workspace.update({ where: { id }, data: { lastReactivatedAt: now } });
      await db.newsletterSeries.create({ data: { id: key, workspaceId: id, name: `PRIVATE_JOB_${id}`, sendRecurrenceKind: 'DAY_OF_MONTH', sendLocalTime: '09:00', generationMode: 'MANUAL', createdById: `u${id}` } });
      await db.newsletterEdition.create({ data: { id: key, seriesId: key, cycleKey: key, intendedSendAt: new Date(now.getTime() - 60000), status: 'SCHEDULED', createdById: `u${id}` } });
      await db.newsletterJob.create({ data: { id: key, editionId: key, type: 'SEND', dueAt: new Date(now.getTime() - 60000), idempotencyKey: key } });
    }
    for (const id of ['a', 'b']) {
      const reply = await read(id); assert.equal(reply.status, 200, reply.text); assert.match(reply.headers['cache-control'], /private.*no-store/);
      const health = JSON.parse(reply.text).health;
      assert.equal(health.editionReviewAvailable, false); assert.equal(health.automaticRetryAllowed, false);
      assert.equal(health.jobs.find(job => job.id === `studio-job-${id}`)?.heldForReactivation, true);
      assert.ok(!reply.text.includes(`PRIVATE_JOB_${id === 'a' ? 'b' : 'a'}`));
      assert.equal((await http(origin, `${id}.example.test`, '/api/admin/newsletters/jobs/health', { headers: { cookie: driver.cookie(id) } })).status, 403);
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      await db.workspaceMembership.update({ where, data: { role: 'VIEWER' } }); assert.equal((await read(id)).status, 403);
      await db.workspaceMembership.update({ where, data: { role: 'OWNER', status: 'REVOKED' } }); assert.equal((await read(id)).status, 403);
      await db.workspaceMembership.update({ where, data: { status: 'ACTIVE' } });
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } }); assert.equal((await read(id)).status, 403);
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
      cases.push({ tenant: id, ownedHeldJobRendered: true, foreignSelectorsIgnored: true, privateNoStore: true, currentRoleRevocationSuspensionDenied: true, originalModuleGatePreserved: true, editionActionsUnavailable: true });
    }
    assert.equal((await http(origin, 'a.example.test', '/api/admin/studio/newsletter-jobs')).status, 401);
    assert.equal((await http(origin, 'a.example.test', '/api/admin/studio/newsletter-jobs', { method: 'POST', headers: { cookie: driver.cookie('a') }, body: {} })).status, 405);
    return { cases, actualNextHttp: true, readOnly: true, providerCalls: false };
  } finally {
    await db.newsletterEdition.deleteMany({ where: { id: { in: ids } } });
    await db.newsletterSeries.deleteMany({ where: { id: { in: ids } } });
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: { lifecycleState: row.lifecycleState, lifecycleRevision: row.lifecycleRevision, lastReactivatedAt: row.lastReactivatedAt, updatedAt: row.updatedAt } });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
