import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyMediaDelete(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async () => ({
    projects: await db.project.findMany({ orderBy: { id: 'asc' } }),
    media: await db.media.findMany({ orderBy: { id: 'asc' } }),
    heroes: await db.projectMediaCollectionHero.findMany({ orderBy: [{ projectId: 'asc' }, { serviceId: 'asc' }] }),
    assets: await db.workspaceAsset.findMany({ orderBy: { id: 'asc' } }),
  });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a', mediaId = `packet68-${id}`, serviceId = `packet68-service-${id}`;
    await db.service.create({ data: { id: serviceId, workspaceId: id, name: 'Synthetic deletion', slug: 'packet68-delete' } });
    const asset = await db.workspaceAsset.findFirst({ where: { workspaceId: id, provider: 'R2' } });
    assert.ok(asset);
    await db.media.create({ data: { id: mediaId, projectId: `p${id}`, serviceId, sourceType: 'UPLOADED_IMAGE', mediaCategory: 'PHOTOGRAPHY', storageKey: asset.providerKey, assetId: asset.id, mimeType: 'image/jpeg' } });
    await db.project.update({ where: { id: `p${id}` }, data: { heroMediaId: mediaId, thumbnailMediaId: mediaId, socialImageMediaId: mediaId } });
    await db.projectMediaCollectionHero.create({ data: { projectId: `p${id}`, serviceId, mediaCategory: 'PHOTOGRAPHY', mediaId } });
    const remove = (selected = mediaId, project = `p${id}`) => http(origin, `${other}.example.test`, `/api/admin/projects/${project}/media`, {
      method: 'DELETE', headers: { cookie: driver.cookie(id), 'x-workspace-id': other }, body: { mediaId: selected, workspaceId: other },
    });
    const initial = await snapshot();
    const foreign = await db.media.findFirst({ where: { project: { workspaceId: other } } }); assert.ok(foreign);
    assert.equal((await remove(foreign.id)).status, 404);
    assert.equal((await remove(foreign.id, `p${other}`)).status, 404);
    assert.deepEqual(await snapshot(), initial);
    for (const change of ['revoked', 'viewer', 'session-version']) {
      const before = await snapshot(); let pending;
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = remove().then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true);
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, 403); assert.deepEqual(await snapshot(), before);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: 403, mediaPointersAndRegistryUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
      }
    }
    const beforeFailure = await snapshot();
    await db.$executeRawUnsafe(`CREATE FUNCTION packet68_reject_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic delete failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet68_reject_delete AFTER DELETE ON "Media" FOR EACH ROW EXECUTE FUNCTION packet68_reject_delete()`);
      assert.equal((await remove()).status, 500); assert.deepEqual(await snapshot(), beforeFailure);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet68_reject_delete ON "Media"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet68_reject_delete()`);
    }
    const before = await snapshot();
    const responses = await Promise.all([remove(), remove()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 404]);
    const success = JSON.parse(responses.find(r => r.status === 200).text);
    assert.equal(success.storageCleanupPending, true); assert.equal(success.deletedMediaId, mediaId);
    assert.equal(await db.media.count({ where: { id: mediaId } }), 0);
    assert.equal(await db.projectMediaCollectionHero.count({ where: { mediaId } }), 0);
    const project = await db.project.findUnique({ where: { id: `p${id}` } });
    for (const key of ['heroMediaId', 'thumbnailMediaId', 'socialImageMediaId']) assert.equal(project[key], null);
    assert.equal((await remove()).status, 404);
    // Stream reference deletion also retains the shared asset registration.
    const streamAsset = await db.workspaceAsset.findFirst({ where: { workspaceId: id, provider: 'CLOUDFLARE_STREAM' } }); assert.ok(streamAsset);
    const streamId = `packet68-stream-${id}`;
    await db.media.create({ data: { id: streamId, projectId: `p${id}`, serviceId, sourceType: 'VIDEO_EMBED', mediaCategory: 'OTHER', provider: 'CLOUDFLARE_STREAM', externalId: streamAsset.providerKey, assetId: streamAsset.id } });
    const streamResponse = await remove(streamId); assert.equal(streamResponse.status, 200); assert.equal(JSON.parse(streamResponse.text).storageCleanupPending, true);
    const after = await snapshot();
    assert.deepEqual(after.assets, before.assets);
    assert.deepEqual(after.projects.filter(p => p.workspaceId === other), before.projects.filter(p => p.workspaceId === other));
    assert.deepEqual(after.media.filter(m => m.projectId === `p${other}`), before.media.filter(m => m.projectId === `p${other}`));
    assert.deepEqual(after.heroes.filter(h => h.projectId === `p${other}`), before.heroes.filter(h => h.projectId === `p${other}`));
  }
  return { races, foreignMediaAndProjectDenied: true, failedDeleteRollsBackPointers: true, concurrentDeleteSingleWinner: true, ownedPointerCleanupBothDirections: true, imageAndStreamRegistryRetained: true, providerCalls: false, hosted: false };
}
