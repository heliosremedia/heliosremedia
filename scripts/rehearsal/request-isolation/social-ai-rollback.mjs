import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifySocialAiRollback(origin, driver) {
  const db = driver.prisma;
  const cases = [];
  const absent = async () => {
    const rows = await db.$queryRaw`SELECT to_regprocedure('packet35_second_variant()')::text AS function_name,
      (SELECT count(*)::integer FROM pg_trigger WHERE tgname='packet35_second_variant') AS triggers`;
    assert.equal(rows[0].function_name, null); assert.equal(rows[0].triggers, 0);
  };
  await absent();
  for (const id of ['a', 'b']) await db.socialCampaign.create({ data: {
    id: `ai-rollback-${id}`, workspaceId: id, internalName: 'Synthetic rollback qualification', sourceType: 'PROJECT',
    sourceRecordIds: [`ai-project-${id}`], selectedPlatforms: ['FACEBOOK', 'INSTAGRAM'], createdById: `u${id}`, lastEditedById: `u${id}`,
    variants: { create: ['FACEBOOK', 'INSTAGRAM'].map(platform => ({ id: `ai-rollback-${platform}-${id}`, platform,
      postType: platform === 'FACEBOOK' ? 'IMAGE_POST' : 'SINGLE_IMAGE', status: 'APPROVED', caption: `BEFORE_${id}`,
      approvedAt: new Date(), approvalActorId: `u${id}` })) },
  } });
  const snapshot = async id => ({
    campaigns: await db.socialCampaign.findMany({ where: { workspaceId: id }, orderBy: { id: 'asc' } }),
    variants: await db.socialVariant.findMany({ where: { campaign: { workspaceId: id } }, orderBy: { id: 'asc' } }),
    approvals: await db.socialApprovalEvent.findMany({ where: { variant: { campaign: { workspaceId: id } } }, orderBy: { id: 'asc' } }),
  });
  const send = id => http(origin, `${id}.example.test`, '/api/admin/social/ai', { method: 'POST', headers: { cookie: driver.cookie(id) },
    body: { campaignId: `ai-rollback-${id}`, requestId: `ai-rollback-request-${id}` } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const before = await snapshot(id); const foreign = await snapshot(other);
    let pending;
    try {
      // Disposable database only. This AFTER trigger reaches the barrier only
      // when both variants have been updated inside the same transaction.
      // It is independent of unspecified variant iteration order.
      await db.$executeRawUnsafe(`CREATE FUNCTION packet35_second_variant() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."campaignId" IN ('ai-rollback-a','ai-rollback-b') AND NEW.caption LIKE 'AI_DRAFT_%'
          AND (SELECT count(*) FROM "SocialVariant" WHERE "campaignId"=NEW."campaignId" AND caption=NEW.caption)=2 THEN
          PERFORM pg_advisory_xact_lock(3500, CASE WHEN NEW."campaignId"='ai-rollback-a' THEN 1 ELSE 2 END);
        END IF;
        RETURN NEW;
      END $$`);
      await db.$executeRawUnsafe('CREATE TRIGGER packet35_second_variant AFTER UPDATE ON "SocialVariant" FOR EACH ROW EXECUTE FUNCTION packet35_second_variant()');
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(3500, ${id === 'a' ? 1 : 2}::integer)`;
        const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        pending = send(id).then(response => ({ response }), error => ({ error }));
        const deadline = Date.now() + 8000; let blockedPid;
        while (Date.now() < deadline) {
          const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
            AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%SocialVariant%'`;
          if (rows.length) { assert.equal(rows.length, 1); blockedPid = rows[0].pid; break; }
          await delay(25);
        }
        assert.ok(blockedPid, 'Second-variant write must be observed waiting after first-variant mutation');
        const waiting = await snapshot(id);
        assert.deepEqual(waiting.variants, before.variants); assert.deepEqual(waiting.approvals, before.approvals);
        const cancelled = await db.$queryRaw`SELECT pg_cancel_backend(${blockedPid}::integer) AS cancelled`;
        assert.equal(cancelled[0].cancelled, true);
        const outcome = await pending; if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, 502, outcome.response.text);
      }, { timeout: 15000 });
    } finally {
      await pending;
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS packet35_second_variant ON "SocialVariant"');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS packet35_second_variant()');
    }
    await absent();
    const failed = await snapshot(id);
    assert.deepEqual(failed.variants, before.variants); assert.deepEqual(failed.approvals, before.approvals);
    assert.deepEqual(await snapshot(other), foreign);
    const campaign = failed.campaigns.find(row => row.id === `ai-rollback-${id}`);
    assert.equal(campaign.generationStatus, 'FAILED'); assert.equal(campaign.status, 'DRAFT'); assert.equal(campaign.purpose, null);
    const retry = await send(id); assert.equal(retry.status, 200, retry.text);
    const completed = await snapshot(id);
    const variants = completed.variants.filter(row => row.campaignId === campaign.id);
    assert.equal(variants.length, 2);
    for (const row of variants) {
      assert.equal(row.caption, `AI_DRAFT_${id}`); assert.equal(row.contentVersion, 2); assert.equal(row.status, 'NEEDS_REVIEW');
      assert.equal(row.approvedAt, null); assert.equal(row.approvalActorId, null);
      assert.equal(completed.approvals.filter(event => event.variantId === row.id && event.action === 'REVOKED').length, 1);
    }
    assert.equal(completed.campaigns.find(row => row.id === campaign.id).generationStatus, 'SUCCEEDED');
    assert.equal(completed.approvals.length, before.approvals.length + 2);
    const replay = await send(id); assert.equal(replay.status, 200); assert.equal(JSON.parse(replay.text).duplicate, true);
    assert.deepEqual(await snapshot(id), completed); assert.deepEqual(await snapshot(other), foreign);
    cases.push({ tenant: id, secondVariantWaitObserved: true, cancelledOnlyObservedQuery: true, failure502: true,
      bothVariantsRolledBack: true, approvalEventsRolledBack: true, campaignEditsRolledBack: true,
      retryBothDrafts: true, oneApprovalRevocationPerVariant: true, replayInert: true, foreignRowsUnchanged: true });
  }
  await absent();
  assert.equal(await db.socialPublishingJob.count(), 0); assert.equal(await db.socialPublication.count(), 0);
  return { cases, injectionRemoved: true, liveProviderCalls: false, publishingJobs: 0, publications: 0 };
}
