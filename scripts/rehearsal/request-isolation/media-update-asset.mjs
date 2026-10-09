import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyMediaUpdateAsset(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async () => ({ media: await db.media.findMany({ orderBy: { id: 'asc' } }), heroes: await db.projectMediaCollectionHero.findMany({ orderBy: [{ projectId: 'asc' }, { serviceId: 'asc' }] }) });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const serviceId = `packet65-${id}`;
    await db.service.create({ data: { id: serviceId, workspaceId: id, name: 'Synthetic destination', slug: 'packet65-destination' } });
    const upload = async () => {
      const response = await http(origin, `${other}.example.test`, `/api/admin/projects/p${id}/stream-upload`, { method: 'POST', headers: { cookie: driver.cookie(id), 'upload-length': '100', 'tus-resumable': '1.0.0' } });
      assert.equal(response.status, 201); return response.headers['stream-media-id'];
    };
    const originalUid = await upload(), replacementUid = await upload();
    const asset = await db.workspaceAsset.findFirst({ where: { provider: 'CLOUDFLARE_STREAM', providerKey: replacementUid } });
    const created = await http(origin, `${other}.example.test`, `/api/admin/projects/p${id}/media`, { method: 'POST', headers: { cookie: driver.cookie(id) }, body: { streamUid: originalUid, originalFilename: 'Before', mediaCategory: 'PHOTOGRAPHY', serviceId: `s${id}` } });
    assert.equal(created.status, 201); const mediaId = JSON.parse(created.text).media.id;
    await db.projectMediaCollectionHero.upsert({ where: { projectId_serviceId: { projectId: `p${id}`, serviceId: `s${id}` } }, create: { projectId: `p${id}`, serviceId: `s${id}`, mediaCategory: 'PHOTOGRAPHY', mediaId }, update: { mediaId } });
    let reviewedVersion = JSON.parse(created.text).media.updatedAt;
    assert.ok(reviewedVersion);
    const patch = (changes = {}) => http(origin, `${other}.example.test`, `/api/admin/projects/p${id}/media`, { method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other }, body: { action: 'update-asset', expectedUpdatedAt: reviewedVersion, mediaId, serviceId, externalUrl: `https://iframe.videodelivery.net/${replacementUid}`, originalFilename: 'After', mediaCategory: 'OTHER', visibility: 'VISIBLE', workspaceId: other, ...changes } });
    const initial = await snapshot();
    const foreignMedia = await db.media.findFirst({ where: { project: { workspaceId: other } } });
    assert.ok(foreignMedia);
    assert.equal((await patch({ mediaId: foreignMedia.id })).status, 404);
    assert.equal((await patch({ mediaId: 'missing' })).status, 404);
    assert.equal((await patch({ serviceId: `s${other}` })).status, 409);
    assert.deepEqual(await snapshot(), initial);
    for (const change of ['revoked', 'viewer', 'session-version', 'service-archived', 'asset-quarantined', 'asset-owner']) {
      const before = await snapshot(); let pending;
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = patch().then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true);
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else if (change === 'service-archived') await tx.service.update({ where: { id: serviceId }, data: { archivedAt: new Date() } });
          else if (change === 'asset-quarantined') await tx.workspaceAsset.update({ where: { id: asset.id }, data: { status: 'QUARANTINED' } });
          else if (change === 'asset-owner') await tx.workspaceAsset.update({ where: { id: asset.id }, data: { workspaceId: other } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = change.startsWith('asset-') ? 400 : change === 'service-archived' ? 409 : 403;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), before);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, mediaAndHeroesUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.service.update({ where: { id: serviceId }, data: { archivedAt: null } });
        await db.workspaceAsset.update({ where: { id: asset.id }, data: { workspaceId: asset.workspaceId, status: asset.status } });
      }
    }
    const beforeFailure = await snapshot();
    await db.$executeRawUnsafe(`CREATE FUNCTION packet65_reject_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic media update failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet65_reject_update BEFORE UPDATE ON "Media" FOR EACH ROW EXECUTE FUNCTION packet65_reject_update()`);
      assert.equal((await patch()).status, 500); assert.deepEqual(await snapshot(), beforeFailure, 'Hero removal must roll back when media update fails');
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet65_reject_update ON "Media"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet65_reject_update()`);
    }
    const foreignBefore = await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } });
    const concurrent = await Promise.all([patch(), patch()]);
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409]);
    const savedSnapshot = await snapshot();
    assert.equal((await patch()).status, 409);
    assert.deepEqual(await snapshot(), savedSnapshot);
    const media = await db.media.findUnique({ where: { id: mediaId } });
    assert.equal(media.assetId, asset.id); assert.equal(media.externalId, replacementUid); assert.equal(media.serviceId, serviceId); assert.equal(media.originalFilename, 'After');
    assert.equal(await db.projectMediaCollectionHero.count({ where: { mediaId } }), 0);
    assert.deepEqual(await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } }), foreignBefore);
    // An unchanged URL does not require retroactive registration; this preserves the existing compatibility rule.
    const legacy = `https://iframe.videodelivery.net/${(id === 'a' ? 'c' : 'd').repeat(32)}`;
    await db.media.update({ where: { id: mediaId }, data: { externalUrl: legacy, externalId: (id === 'a' ? 'c' : 'd').repeat(32), assetId: null } });
    reviewedVersion = (await db.media.findUnique({ where: { id: mediaId } })).updatedAt.toISOString();
    assert.equal((await patch({ externalUrl: legacy })).status, 200);
    assert.equal((await db.media.findUnique({ where: { id: mediaId } })).assetId, null);
  }
  return { reviewedConcurrentSingleWinner: true, staleReplayUnchanged: true, races, foreignMediaAndServiceDenied: true, heroRollbackOnUpdateFailure: true, replacementAssetLinkedBothDirections: true, unchangedLegacyPreserved: true, provider: 'synthetic Stream provisioning; update makes no provider request', hosted: false };
}
