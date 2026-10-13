import assert from 'node:assert/strict';
import { http } from './http.mjs';

// Real HTTP/authentication/Prisma; only provider responses are synthetic.
export async function qualifySocialAiProviderFailure(origin, driver) {
  const db = driver.prisma;
  const cases = [];
  const modes = ['gen-http', 'gen-json', 'gen-timeout', 'ground-http', 'ground-json', 'ground-empty', 'ground-type', 'ground-platform', 'ground-brief', 'ground-extra', 'ground-claims'];
  const snapshot = async workspaceId => ({
    campaigns: await db.socialCampaign.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }),
    variants: await db.socialVariant.findMany({ where: { campaign: { workspaceId } }, orderBy: { id: 'asc' } }),
    approvals: await db.socialApprovalEvent.findMany({ where: { variant: { campaign: { workspaceId } } }, orderBy: { id: 'asc' } }),
  });
  for (const id of ['a', 'b']) for (const mode of modes) {
    const campaignId = `ai-failure-${id}-${mode}`;
    const projectId = `${campaignId}-source`;
    const variantId = `${campaignId}-variant`;
    const requestId = `${campaignId}-request`;
    await db.project.create({ data: { id: projectId, workspaceId: id, slug: projectId, title: `AI_FACT_${id} PACKET36_${mode}`, status: 'PUBLISHED' } });
    await db.socialCampaign.create({ data: {
      id: campaignId, workspaceId: id, internalName: 'Synthetic provider failure', sourceType: 'PROJECT', sourceRecordIds: [projectId],
      purpose: 'Preserved purpose', selectedPlatforms: ['FACEBOOK'], createdById: `u${id}`, lastEditedById: `u${id}`,
      variants: { create: { id: variantId, platform: 'FACEBOOK', postType: 'IMAGE_POST', status: 'APPROVED', caption: `BEFORE_${id}`, approvedAt: new Date(), approvalActorId: `u${id}` } },
    } });
    const variantBefore = await db.socialVariant.findUniqueOrThrow({ where: { id: variantId } });
    const approvalsBefore = await db.socialApprovalEvent.findMany({ where: { variantId } });
    const other = id === 'a' ? 'b' : 'a'; const foreign = await snapshot(other);
    const send = () => http(origin, `${id}.example.test`, '/api/admin/social/ai', {
      method: 'POST', headers: { cookie: driver.cookie(id) }, body: { campaignId, requestId, workspaceId: other },
    });
    const failed = await send(); assert.equal(failed.status, 502, `${id}/${mode}: ${failed.text}`);
    assert.equal(JSON.parse(failed.text).success, false); assert.match(JSON.parse(failed.text).error, /Existing content was preserved/);
    assert.doesNotMatch(failed.text, /provider-private-detail|PACKET36_|AI_FACT_/);
    assert.deepEqual(await db.socialVariant.findUniqueOrThrow({ where: { id: variantId } }), variantBefore);
    assert.deepEqual(await db.socialApprovalEvent.findMany({ where: { variantId } }), approvalsBefore);
    const failedCampaign = await db.socialCampaign.findUniqueOrThrow({ where: { id: campaignId } });
    assert.equal(failedCampaign.generationStatus, 'FAILED'); assert.equal(failedCampaign.generationRequestId, requestId);
    assert.equal(failedCampaign.purpose, 'Preserved purpose'); assert.equal(failedCampaign.status, 'DRAFT');
    assert.equal(failedCampaign.generationError, JSON.parse(failed.text).error);
    assert.deepEqual(await snapshot(other), foreign);
    await db.project.update({ where: { id: projectId }, data: { title: `AI_FACT_${id}` } });
    const retried = await send(); assert.equal(retried.status, 200, retried.text);
    const variant = await db.socialVariant.findUniqueOrThrow({ where: { id: variantId } });
    assert.equal(variant.caption, `AI_DRAFT_${id}`); assert.equal(variant.contentVersion, variantBefore.contentVersion + 1);
    assert.equal(variant.status, 'NEEDS_REVIEW'); assert.equal(variant.approvedAt, null); assert.equal(variant.approvalActorId, null);
    assert.equal(await db.socialApprovalEvent.count({ where: { variantId, action: 'REVOKED' } }), 1);
    const campaign = await db.socialCampaign.findUniqueOrThrow({ where: { id: campaignId } });
    assert.equal(campaign.generationStatus, 'SUCCEEDED'); assert.equal(campaign.generationError, null);
    const completed = await snapshot(id);
    const replay = await send(); assert.equal(replay.status, 200); assert.equal(JSON.parse(replay.text).duplicate, true);
    assert.deepEqual(await snapshot(id), completed); assert.deepEqual(await snapshot(other), foreign);
    cases.push({ tenant: id, mode, rejected502: true, safeError: true, ownedFailureSettled: true, contentAndApprovalPreserved: true,
      foreignRowsUnchanged: true, sameRequestRetrySucceeded: true, approvalRevokedOnce: true, replayInert: true });
  }
  assert.equal(await db.socialPublishingJob.count(), 0); assert.equal(await db.socialPublication.count(), 0);
  return { cases, liveProviderCalls: false, publishingJobs: 0, publications: 0 };
}
