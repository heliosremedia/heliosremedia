import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { http } from './http.mjs';
import { requireDatabase } from './safety.mjs';

export async function qualifySocialAiRequestIds(origin, driver) {
  const db = driver.prisma;
  const client = new pg.Client({ connectionString: requireDatabase(process.env.PACKET19_DATABASE_URL) });
  const indexBefore = await driver.schemaIndexFingerprint();
  const snapshot = async workspaceId => ({
    campaigns: await db.socialCampaign.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }),
    variants: await db.socialVariant.findMany({ where: { campaign: { workspaceId } }, orderBy: { id: 'asc' } }),
    approvals: await db.socialApprovalEvent.findMany({ where: { variant: { campaign: { workspaceId } } }, orderBy: { id: 'asc' } }),
  });
  const seed = async (id, label) => {
    const campaignId = `ai-request-${label}-${id}`;
    await db.socialCampaign.create({ data: { id: campaignId, workspaceId: id, internalName: 'Request identity qualification', sourceType: 'PROJECT',
      sourceRecordIds: [`ai-project-${id}`], selectedPlatforms: ['FACEBOOK'], createdById: `u${id}`, lastEditedById: `u${id}`,
      variants: { create: { id: `${campaignId}-variant`, platform: 'FACEBOOK', postType: 'IMAGE_POST', caption: `BEFORE_${id}` } },
    } });
    return campaignId;
  };
  const send = (id, campaignId, requestId) => http(origin, `${id}.example.test`, '/api/admin/social/ai', {
    method: 'POST', headers: { cookie: driver.cookie(id) }, body: { campaignId, requestId },
  });
  const cases = [];
  await client.connect();
  try {
    // This database passed empty-target admission and contains only rehearsal rows.
    // Reconstruct the previous constraint to prove the collision before applying
    // the checked-in migration itself. No production schema is ever connected.
    await client.query('BEGIN; CREATE UNIQUE INDEX "SocialCampaign_generationRequestId_key" ON "SocialCampaign"("generationRequestId"); DROP INDEX "SocialCampaign_workspaceId_generationRequestId_key"; COMMIT;');
    for (const winner of ['a', 'b']) {
      const loser = winner === 'a' ? 'b' : 'a'; const label = `first-${winner}`;
      const requestId = `same-request-${label}`;
      const first = await seed(winner, label); const second = await seed(loser, label);
      const ok = await send(winner, first, requestId); assert.equal(ok.status, 200, ok.text);
      const loserBefore = await snapshot(loser); const winnerBefore = await snapshot(winner);
      const blocked = await send(loser, second, requestId); assert.equal(blocked.status, 500, blocked.text);
      assert.deepEqual(await snapshot(loser), loserBefore); assert.deepEqual(await snapshot(winner), winnerBefore);
      assert.doesNotMatch(blocked.text, /same-request|Unique constraint|SocialCampaign|AI_FACT_/);
      cases.push({ winner, loser, first, second, requestId, legacyCollisionReproduced: true });
    }
    const migration = await readFile(new URL('../../../prisma/migrations/20261004173000_social_generation_workspace_request/migration.sql', import.meta.url), 'utf8');
    await client.query(migration);
    assert.equal(await driver.schemaIndexFingerprint(), indexBefore, 'Migration must converge to the declared Prisma indexes');
    for (const row of cases) {
      const winnerBefore = await snapshot(row.winner);
      const recovered = await send(row.loser, row.second, row.requestId); assert.equal(recovered.status, 200, recovered.text);
      assert.deepEqual(await snapshot(row.winner), winnerBefore);
      for (const [id, campaignId] of [[row.winner, row.first], [row.loser, row.second]]) {
        const campaign = await db.socialCampaign.findUniqueOrThrow({ where: { id: campaignId } });
        assert.equal(campaign.generationRequestId, row.requestId); assert.equal(campaign.generationStatus, 'SUCCEEDED');
        const variant = await db.socialVariant.findUniqueOrThrow({ where: { id: `${campaignId}-variant` } });
        assert.equal(variant.caption, `AI_DRAFT_${id}`); assert.equal(variant.contentVersion, 2);
        const before = await snapshot(id); const replay = await send(id, campaignId, row.requestId);
        assert.equal(replay.status, 200); assert.equal(JSON.parse(replay.text).duplicate, true); assert.deepEqual(await snapshot(id), before);
      }
      const collision = await seed(row.winner, `collision-${row.winner}`);
      const before = await snapshot(row.winner); const foreign = await snapshot(row.loser);
      assert.equal((await send(row.winner, collision, row.requestId)).status, 500);
      assert.deepEqual(await snapshot(row.winner), before); assert.deepEqual(await snapshot(row.loser), foreign);
      Object.assign(row, { bothTenantsSucceeded: true, requestValuesPreserved: true, replayInert: true, sameWorkspaceUniquenessPreserved: true, foreignRowsUnchanged: true });
    }
    const a = await seed('a', 'concurrent'); const b = await seed('b', 'concurrent');
    const responses = await Promise.all([send('a', a, 'same-concurrent-request'), send('b', b, 'same-concurrent-request')]);
    for (const response of responses) assert.equal(response.status, 200, response.text);
    for (const [id, campaignId] of [['a', a], ['b', b]]) {
      const variant = await db.socialVariant.findUniqueOrThrow({ where: { id: `${campaignId}-variant` } });
      assert.equal(variant.caption, `AI_DRAFT_${id}`); assert.equal(variant.contentVersion, 2);
    }
    assert.equal(await driver.schemaIndexFingerprint(), indexBefore);
    return { cases, concurrentSameRequestSucceeded: true, migrationAppliedToSyntheticOnly: true, declaredIndexesRestored: true, liveProviderCalls: false };
  } finally {
    // On failure the disposable service is destroyed; do not retry or mask errors
    // by repairing an unknown index state.
    await client.end();
  }
}
