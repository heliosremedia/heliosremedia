import assert from 'node:assert/strict';
import { http } from './http.mjs';

export async function qualifyNewsletterScheduleEditor(origin, driver) {
  const db = driver.prisma, cases = [], prefix = 'studio-date-';
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const ids = ['a', 'b'].map(id => `${prefix}${id}`);
  const originalDate = new Date(Date.now() + 86400000), changedDate = new Date(Date.now() + 172800000);
  const post = (actor, edition, version, headers = { cookie: driver.cookie(actor) }) => http(origin, `${actor === 'a' ? 'b' : 'a'}.example.test`, `/api/admin/newsletters/editions/${edition}`, {
    method: 'POST', headers: { ...headers, 'x-workspace-id': 'foreign' }, body: { action: 'reschedule', expectedVersion: version, intendedSendAt: changedDate.toISOString(), workspaceId: 'foreign' },
  });
  try {
    for (const id of ['a', 'b']) {
      const key = `${prefix}${id}`;
      await db.newsletterSeries.create({ data: { id: key, workspaceId: id, name: 'Synthetic reviewed schedule', sendRecurrenceKind: 'DAY_OF_MONTH', sendLocalTime: '09:00', generationMode: 'MANUAL', createdById: `u${id}` } });
      await db.newsletterEdition.create({ data: { id: key, seriesId: key, cycleKey: key, intendedSendAt: originalDate, status: 'SCHEDULED', createdById: `u${id}` } });
      await db.newsletterRevision.create({ data: { id: key, editionId: key, revisionNumber: 1, subject: 'Synthetic', blocksSnapshot: [], contentHash: key, createdById: `u${id}` } });
      await db.newsletterEdition.update({ where: { id: key }, data: { approvedRevisionId: key } });
      await db.newsletterApproval.create({ data: { id: key, editionId: key, revisionId: key, approvedById: `u${id}`, approvedSendAt: originalDate, estimatedEligibleCount: 0, estimatedExcludedCount: 0, recipientSelectionSnapshot: {} } });
      await db.newsletterJob.create({ data: { id: key, editionId: key, type: 'SEND', dueAt: originalDate, idempotencyKey: key } });
    }
    for (const id of ['a', 'b']) {
      const key = `${prefix}${id}`, foreignKey = `${prefix}${id === 'a' ? 'b' : 'a'}`;
      const before = await db.newsletterEdition.findUniqueOrThrow({ where: { id: key } });
      const foreign = await db.newsletterEdition.findUniqueOrThrow({ where: { id: foreignKey } });
      assert.equal((await post(id, key, before.rowVersion, {})).status, 401);
      assert.equal((await post(id, foreignKey, before.rowVersion)).status, 404);
      assert.equal((await post(id, key, before.rowVersion + 1)).status, 409);
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      await db.workspaceMembership.update({ where, data: { role: 'VIEWER' } });
      assert.equal((await post(id, key, before.rowVersion)).status, 403);
      await db.workspaceMembership.update({ where, data: { role: 'OWNER' } });
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
      assert.equal((await post(id, key, before.rowVersion)).status, 403);
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
      await db.newsletterJob.update({ where: { id: key }, data: { status: 'CLAIMED', claimToken: key, leaseExpiresAt: new Date(Date.now() + 60000) } });
      assert.equal((await post(id, key, before.rowVersion)).status, 409);
      assert.deepEqual(await db.newsletterEdition.findUniqueOrThrow({ where: { id: key } }), before);
      assert.equal((await db.newsletterApproval.findUniqueOrThrow({ where: { id: key } })).revokedAt, null);
      await db.newsletterJob.update({ where: { id: key }, data: { status: 'PENDING', claimToken: null, leaseExpiresAt: null } });
      const reply = await post(id, key, before.rowVersion); assert.equal(reply.status, 200, reply.text);
      const after = await db.newsletterEdition.findUniqueOrThrow({ where: { id: key } });
      assert.equal(after.status, 'NEEDS_REVIEW'); assert.equal(after.approvedRevisionId, null);
      assert.equal(after.rowVersion, before.rowVersion + 1); assert.equal(after.intendedSendAt.toISOString(), changedDate.toISOString());
      assert.equal(JSON.parse(reply.text).edition.rowVersion, after.rowVersion);
      assert.ok((await db.newsletterApproval.findUniqueOrThrow({ where: { id: key } })).revokedAt);
      assert.equal((await db.newsletterJob.findUniqueOrThrow({ where: { id: key } })).status, 'CANCELLED');
      assert.equal((await post(id, key, before.rowVersion)).status, 409);
      assert.deepEqual(await db.newsletterEdition.findUniqueOrThrow({ where: { id: key } }), after);
      assert.deepEqual(await db.newsletterEdition.findUniqueOrThrow({ where: { id: foreignKey } }), foreign);
      cases.push({ tenant: id, reviewedVersionRequired: true, foreignAnonymousViewerSuspendedDenied: true, activeClaimRollsBack: true, changedDateRequiresNewApproval: true, priorSendJobCancelled: true, staleReplayInert: true, otherCompanyUnchanged: true });
    }
    return { cases, actualNextHttp: true, providerCalls: false, scope: 'explicit reviewed reschedule only; no approval or send activation' };
  } finally {
    await db.auditEvent.deleteMany({ where: { entityId: { in: ids } } });
    await db.newsletterApproval.deleteMany({ where: { editionId: { in: ids } } });
    await db.newsletterEdition.updateMany({ where: { id: { in: ids } }, data: { approvedRevisionId: null } });
    await db.newsletterEdition.deleteMany({ where: { id: { in: ids } } });
    await db.newsletterSeries.deleteMany({ where: { id: { in: ids } } });
    for (const row of memberships) await db.workspaceMembership.update({ where: { id: row.id }, data: row });
    for (const row of workspaces) await db.workspace.update({ where: { id: row.id }, data: { lifecycleState: row.lifecycleState, lifecycleRevision: row.lifecycleRevision, lastReactivatedAt: row.lastReactivatedAt, updatedAt: row.updatedAt } });
    assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
  }
}
