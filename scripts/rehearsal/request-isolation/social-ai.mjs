import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifySocialAi(origin, driver) {
  const db = driver.prisma;
  const result = [];
  for (const id of ['a', 'b']) {
    await db.project.create({ data: { id: `ai-project-${id}`, workspaceId: id, slug: `ai-project-${id}`, title: `AI_FACT_${id}`, status: 'PUBLISHED' } });
    for (const kind of ['write', 'revoke']) {
      await db.socialCampaign.create({ data: {
        id: `ai-${kind}-${id}`, workspaceId: id, internalName: 'Synthetic AI qualification', sourceType: 'PROJECT',
        sourceRecordIds: [`ai-project-${id}`], selectedPlatforms: ['FACEBOOK'], createdById: `u${id}`, lastEditedById: `u${id}`,
        variants: { create: { id: `ai-${kind}-variant-${id}`, platform: 'FACEBOOK', postType: 'IMAGE_POST', status: 'APPROVED', caption: `BEFORE_${id}`, approvedAt: new Date(), approvalActorId: `u${id}` } },
      } });
    }
  }
  const snapshot = async id => ({
    campaigns: await db.socialCampaign.findMany({ where: { workspaceId: id }, orderBy: { id: 'asc' } }),
    variants: await db.socialVariant.findMany({ where: { campaign: { workspaceId: id } }, orderBy: { id: 'asc' } }),
    approvals: await db.socialApprovalEvent.findMany({ where: { variant: { campaign: { workspaceId: id } } }, orderBy: { id: 'asc' } }),
  });
  const send = (id, kind = 'write', extra = {}) => http(origin, `${id}.example.test`, '/api/admin/social/ai', {
    method: 'POST', headers: { cookie: driver.cookie(id) },
    body: { campaignId: `ai-${kind}-${id}`, requestId: `ai-${kind}-request-${id}`, workspaceId: id === 'a' ? 'b' : 'a', ...extra },
  });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const before = await snapshot(id); const foreign = await snapshot(other);
    assert.equal((await send(id, 'write', { campaignId: `ai-write-${other}` })).status, 404);
    assert.equal((await send(id, 'write', { variantId: `ai-write-variant-${other}` })).status, 404);
    assert.deepEqual(await snapshot(id), before); assert.deepEqual(await snapshot(other), foreign);
    await db.socialCampaign.update({ where: { id: `ai-write-${id}` }, data: { sourceRecordIds: [`ai-project-${other}`] } });
    const invalid = await snapshot(id);
    assert.equal((await send(id)).status, 409); assert.deepEqual(await snapshot(id), invalid);
    await db.socialCampaign.update({ where: { id: `ai-write-${id}` }, data: { sourceRecordIds: [`ai-project-${id}`] } });
    const written = await send(id); assert.equal(written.status, 200, written.text);
    const variant = await db.socialVariant.findUniqueOrThrow({ where: { id: `ai-write-variant-${id}` } });
    assert.equal(variant.caption, `AI_DRAFT_${id}`); assert.equal(variant.contentVersion, 2);
    assert.equal(variant.status, 'NEEDS_REVIEW'); assert.equal(variant.approvedAt, null); assert.equal(variant.approvalActorId, null);
    const campaign = await db.socialCampaign.findUniqueOrThrow({ where: { id: `ai-write-${id}` } });
    assert.equal(campaign.generationStatus, 'SUCCEEDED'); assert.equal(campaign.verifiedSourceFacts.title, `AI_FACT_${id}`);
    assert.equal(await db.socialApprovalEvent.count({ where: { variantId: variant.id, action: 'REVOKED' } }), 1);
    const completed = await snapshot(id);
    const replay = await send(id); assert.equal(replay.status, 200); assert.equal(JSON.parse(replay.text).duplicate, true);
    assert.deepEqual(await snapshot(id), completed); assert.deepEqual(await snapshot(other), foreign);

    const revocationBefore = await db.socialVariant.findUniqueOrThrow({ where: { id: `ai-revoke-variant-${id}` } });
    const approvalsBefore = await db.socialApprovalEvent.count();
    let pending;
    try {
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(3400, ${id === 'a' ? 1 : 2}::integer)`;
        const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        pending = send(id, 'revoke').then(response => ({ response }), error => ({ error }));
        const deadline = Date.now() + 8000; let blocked = false;
        while (Date.now() < deadline) {
          const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid} = ANY(pg_blocking_pids(pid)) AND query LIKE '%pg_advisory_xact_lock%'`;
          if (rows.length) { blocked = true; break; } await delay(25);
        }
        assert.equal(blocked, true, 'Provider fixture must wait after committed admission');
        assert.equal((await db.socialCampaign.findUniqueOrThrow({ where: { id: `ai-revoke-${id}` } })).generationStatus, 'RUNNING');
        await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { status: 'REVOKED' } });
      }, { timeout: 15000 });
      const outcome = await pending; if (outcome.error) throw outcome.error;
      assert.equal(outcome.response.status, 403, outcome.response.text);
      assert.deepEqual(await db.socialVariant.findUniqueOrThrow({ where: { id: revocationBefore.id } }), revocationBefore);
      assert.equal(await db.socialApprovalEvent.count(), approvalsBefore);
      assert.equal((await db.socialCampaign.findUniqueOrThrow({ where: { id: `ai-revoke-${id}` } })).generationStatus, 'FAILED');
      assert.deepEqual(await snapshot(other), foreign);
      result.push({ tenant: id, foreignCampaign404: true, foreignVariant404: true, foreignSource409: true, ownedDraftPersisted: true,
        approvalRevoked: true, replayInert: true, providerWaitObserved: true, revokedSettlement403: true, revokedVariantUnchanged: true, foreignRowsUnchanged: true });
    } finally {
      await pending;
      await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { status: 'ACTIVE' } });
    }
  }
  assert.equal(await db.socialPublishingJob.count(), 0); assert.equal(await db.socialPublication.count(), 0);
  return { cases: result, provider: 'synthetic fetch substitution; no network fallback', liveProviderCalls: false, publishingJobs: 0, publications: 0 };
}
