import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

export async function qualifyReferralPreparation(driver) {
  const db = driver.prisma, cases = [];
  for (const id of ['a', 'b']) {
    const campaignId = `preparation-${id}`, revisionId = `preparation-revision-${id}`, attemptId = `preparation-attempt-${id}`;
    await db.referralCampaign.create({ data: { id: campaignId, workspaceId: id, createdById: `u${id}`,
      internalName: 'Synthetic', publicTitle: 'Synthetic', purpose: 'Synthetic', audienceMode: 'INDIVIDUALS', audienceRules: {},
      terms: 'Synthetic', landingHeadline: 'Synthetic', landingBody: 'Synthetic', landingThankYou: 'Synthetic', privacyNotice: 'Synthetic',
      invitationSubject: 'Synthetic', invitationBody: 'Synthetic', followUpConfiguration: {}, communicationTemplates: {} } });
    await db.referralCampaignRevision.create({ data: { id: revisionId, campaignId, revisionNumber: 1, snapshot: { workspaceId: id }, contentHash: 'synthetic' } });
    const leaseExpiresAt = new Date(Date.now() + 120000);
    await db.referralCampaign.update({ where: { id: campaignId }, data: { status: 'LAUNCHING', approvedRevisionId: revisionId, launchRevisionId: revisionId, launchAttemptId: attemptId, launchLeaseExpiresAt: leaseExpiresAt } });
    const claim = { workspaceId: id, storedWorkspaceId: id, campaignId, revisionId, campaignVersion: 0, attemptId, leaseExpiresAt };
    const snapshot = async () => ({ campaigns: await db.referralCampaign.findMany({ orderBy: { id: 'asc' } }), audit: await db.referralAuditEvent.findMany({ orderBy: { id: 'asc' } }) });
    const apply = input => db.$transaction(async tx => {
      await driver.lockReferralPreparationSource(tx, input);
      await tx.referralAuditEvent.create({ data: { campaignId, action: 'SYNTHETIC_PREPARATION_ADMITTED', summary: 'Synthetic source guard marker' } });
    });
    const before = await snapshot();
    for (const input of [{ ...claim, storedWorkspaceId: id === 'a' ? 'b' : 'a' }, { ...claim, campaignVersion: 1 }, { ...claim, attemptId: 'stale' }, { ...claim, revisionId: 'stale' }, { ...claim, leaseExpiresAt: new Date(0) }]) {
      await assert.rejects(apply(input), /CLAIM_EXPIRED/); assert.deepEqual(await snapshot(), before);
    }
    // The production wrapper remains contained; the source/lease core can be
    // independently exercised with two synthetic owners without enabling a sender.
    await assert.rejects(db.$transaction(tx => driver.lockReferralPreparationClaim(tx, claim)), /CONTAINED/);
    await db.referralCampaignRevision.update({ where: { id: revisionId }, data: { snapshot: { workspaceId: id === 'a' ? 'b' : 'a' } } });
    const badSnapshot = await snapshot(); await assert.rejects(apply(claim), /CLAIM_EXPIRED/); assert.deepEqual(await snapshot(), badSnapshot);
    await db.referralCampaignRevision.update({ where: { id: revisionId }, data: { snapshot: { workspaceId: id } } });
    await apply(claim);
    const admitted = await snapshot(); let pending, observed = false;
    const replacementLease = new Date(leaseExpiresAt.getTime() + 60000);
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ReferralCampaign" WHERE id=${campaignId} FOR UPDATE`;
      const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
      pending = apply(claim).then(() => ({ ok: true }), error => ({ ok: false, error }));
      const until = Date.now() + 4000;
      while (Date.now() < until) {
        const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%ReferralCampaign%'`;
        if (rows.length) { assert.equal(rows.length, 1); observed = true; break; }
        await delay(25);
      }
      assert.equal(observed, true);
      await tx.referralCampaign.update({ where: { id: campaignId }, data: { launchLeaseExpiresAt: replacementLease } });
    }, { timeout: 15000 });
    const outcome = await pending; assert.equal(outcome.ok, false); assert.match(outcome.error.message, /CLAIM_EXPIRED/);
    assert.deepEqual((await snapshot()).audit, admitted.audit);
    const replaced = await snapshot();
    for (const data of [{ status: 'APPROVED' }, { launchFailedAt: new Date() }, { launchLeaseExpiresAt: new Date(replacementLease.getTime() + 60000) }]) {
      assert.equal((await db.referralCampaign.updateMany({ where: driver.referralPreparationWhere(claim), data })).count, 0);
      assert.deepEqual(await snapshot(), replaced);
    }
    await apply({ ...claim, leaseExpiresAt: replacementLease });
    const expired = new Date(0);
    await db.referralCampaign.update({ where: { id: campaignId }, data: { launchLeaseExpiresAt: expired } });
    const expiredBefore = await snapshot(); await assert.rejects(apply({ ...claim, leaseExpiresAt: expired }), /CLAIM_EXPIRED/); assert.deepEqual(await snapshot(), expiredBefore);
    await db.referralCampaign.update({ where: { id: campaignId }, data: { launchLeaseExpiresAt: replacementLease } });
    cases.push({ tenant: id, sourceAndRevisionRejected: true, rejectedSnapshotsUnchanged: true, campaignWaitObserved: true, replacedLeaseRejectedAfterWait: true, staleProgressCompletionAndFailureInert: true, replacementWorkerAdmitted: true, expiryRechecked: true, sendingContainmentPreserved: true });
  }
  return { cases, providerCalls: false, qualification: 'actual transaction source/lease core and settlement predicates; batch processor composition separately module-tested; legacy sending remains contained' };
}
