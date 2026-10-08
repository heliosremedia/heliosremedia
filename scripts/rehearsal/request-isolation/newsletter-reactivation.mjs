import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { requireDatabase } from './safety.mjs';

export async function qualifyNewsletterReactivation(driver) {
  const db = driver.prisma, cases = [], races = [];
  const client = new pg.Client({ connectionString: requireDatabase(process.env.PACKET19_DATABASE_URL) });
  await client.connect();
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const oldJobs = await db.newsletterJob.findMany({ orderBy: { id: 'asc' } });
  const prefix = 'reactivation85-';
  const now = new Date(), cutoff = new Date(now.getTime() - 2000), due = new Date(now.getTime() - 1000);
  try {
    for (const id of ['a', 'b']) {
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE', lastReactivatedAt: cutoff } });
      const seriesId = `${prefix}${id}`;
      await db.newsletterSeries.create({ data: { id: seriesId, workspaceId: id, name: 'Synthetic reactivation', sendRecurrenceKind: 'DAY_OF_MONTH', sendLocalTime: '09:00', generationMode: 'MANUAL', createdById: `u${id}` } });
      for (const kind of ['future', 'overdue', 'boundary', 'generation']) {
        const editionId = `${seriesId}-${kind}`, date = kind === 'overdue' ? new Date(cutoff.getTime() - 1) : kind === 'boundary' ? cutoff : due;
        await db.newsletterEdition.create({ data: { id: editionId, seriesId, cycleKey: kind, intendedSendAt: date, generationDueAt: date, status: kind === 'generation' ? 'AWAITING_GENERATION' : 'SCHEDULED', createdById: `u${id}` } });
        if (kind !== 'generation') {
          await db.newsletterRevision.create({ data: { id: editionId, editionId, revisionNumber: 1, subject: 'Synthetic', blocksSnapshot: [], contentHash: 'synthetic', createdById: `u${id}` } });
          await db.newsletterEdition.update({ where: { id: editionId }, data: { approvedRevisionId: editionId } });
        }
        await db.newsletterJob.create({ data: { id: editionId, editionId, type: kind === 'generation' ? 'GENERATE' : 'SEND', dueAt: date, idempotencyKey: editionId } });
      }
    }
    let claimed = await driver.claimDueNewsletterJobs({ now, limit: 100 });
    const own = claimed.filter(job => job.id.startsWith(prefix));
    assert.deepEqual(own.map(job => job.id).sort(), ['a', 'b'].flatMap(id => ['future', 'generation'].map(kind => `${prefix}${id}-${kind}`)).sort());
    for (const id of ['a', 'b']) {
      const other = id === 'a' ? 'b' : 'a';
      const foreign = await db.newsletterJob.findMany({ where: { edition: { series: { workspaceId: other } } }, orderBy: { id: 'asc' } });
      const send = own.find(job => job.id === `${prefix}${id}-future`), generate = own.find(job => job.id === `${prefix}${id}-generation`);
      const admission = job => db.$transaction(tx => job.type === 'SEND'
        ? driver.requireNewsletterDeliveryAccess(tx, job.editionId, id, due, { kind: 'BACKGROUND', jobId: job.id, claimToken: job.claimToken })
        : driver.requireNewsletterGenerationAccess(tx, job.editionId, id, { kind: 'BACKGROUND', jobId: job.id, claimToken: job.claimToken }));
      await admission(send); await admission(generate);
      const actor = { userId: `u${id}`, workspaceId: id, sessionVersion: 1 };
      const initialHealth = await driver.getNewsletterJobHealth(actor);
      assert.equal(initialHealth.jobs.find(job => job.id === send.id)?.heldForReactivation, false);
      for (const job of [send, generate]) {
        let pending;
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = admission(job).then(() => ({ allowed: true }), error => ({ error }));
            let observed = false;
            for (const deadline = Date.now() + 8000; Date.now() < deadline;) {
              const result = await client.query('SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid]);
              if (result.rows.length) { observed = true; break; }
              await delay(30);
            }
            assert.ok(observed, 'Actual provider-admission database wait required');
            await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
          }, { timeout: 15000 });
          assert.match((await pending).error?.message ?? '', /WORKSPACE_SCHEDULE_SUSPENDED/);
          races.push({ tenant: id, action: job.type, databaseWaitObserved: true, admissionDenied: true });
        } finally {
          await pending;
          await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
        }
      }
      await db.workspace.update({ where: { id }, data: { lastReactivatedAt: now } });
      const heldHealth = await driver.getNewsletterJobHealth(actor);
      assert.equal(heldHealth.jobs.find(job => job.id === send.id)?.heldForReactivation, true);
      assert.equal(heldHealth.jobs.find(job => job.id === generate.id)?.heldForReactivation, true);
      assert.ok(!heldHealth.jobs.some(job => job.id.startsWith(`${prefix}${other}`)));
      await assert.rejects(admission(send), /RECOVERY_REQUIRED/);
      await assert.rejects(admission(generate), /RECOVERY_REQUIRED/);
      // Settlement remains possible for the original claim despite lifecycle denial.
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
      assert.equal(await driver.completeNewsletterJob(send), true);
      assert.equal(await driver.completeNewsletterJob(send), false);
      assert.deepEqual(await db.newsletterJob.findMany({ where: { edition: { series: { workspaceId: other } } }, orderBy: { id: 'asc' } }), foreign);
      cases.push({ tenant: id, heldJobsVisibleInOwnedReview: true, futureApprovalRetained: true, overdueAndEqualityHeld: true, generationAndSendAdmission: true, reactivationInvalidatesMissedClaim: true, suspendedSettlementAllowed: true, duplicateSettlementInert: true, otherCompanyUnchanged: true });
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
    }
    return { cases, races, providerCalls: false, scope: 'newsletter-claim-and-execution-admission; other families and notifications remain open' };
  } finally {
    await db.newsletterEdition.updateMany({ where: { id: { startsWith: prefix } }, data: { approvedRevisionId: null } });
    await db.newsletterEdition.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.newsletterSeries.deleteMany({ where: { id: { startsWith: prefix } } });
    for (const original of oldJobs) await db.newsletterJob.update({ where: { id: original.id }, data: original });
    for (const original of workspaces) await db.workspace.update({ where: { id: original.id }, data: { lifecycleState: original.lifecycleState, lifecycleRevision: original.lifecycleRevision, lastReactivatedAt: original.lastReactivatedAt, updatedAt: original.updatedAt } });
    assert.deepEqual(await db.newsletterJob.findMany({ orderBy: { id: 'asc' } }), oldJobs);
    assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), workspaces);
    await client.end();
  }
}
