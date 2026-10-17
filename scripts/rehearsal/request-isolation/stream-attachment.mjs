import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyStreamAttachment(origin, driver, mode = 'direct') {
  const db = driver.prisma, races = [];
  const snapshot = () => db.media.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const upload = await http(origin, `${other}.example.test`, `/api/admin/projects/p${id}/stream-upload`, { method: 'POST', headers: { cookie: driver.cookie(id), 'upload-length': '100', 'tus-resumable': '1.0.0' } });
    assert.equal(upload.status, 201);
    const uid = upload.headers['stream-media-id'];
    const asset = await db.workspaceAsset.findFirst({ where: { provider: 'CLOUDFLARE_STREAM', providerKey: uid } });
    assert.equal(asset.workspaceId, id);
    const post = (projectId = `p${id}`, streamUid = uid) => http(origin, `${other}.example.test`, `/api/admin/projects/${projectId}/media`, { method: 'POST', headers: { cookie: driver.cookie(id), 'x-workspace-id': other }, body: { ...(mode === 'external' ? { externalUrl: `https://iframe.videodelivery.net/${streamUid}` } : { streamUid }), originalFilename: 'Synthetic video', mediaCategory: 'PHOTOGRAPHY', serviceId: `s${id}`, workspaceId: other } });
    const initial = await snapshot();
    assert.equal((await post(`p${other}`)).status, 404);
    assert.equal((await post(`p${id}`, 'f'.repeat(32))).status, 400);
    assert.deepEqual(await snapshot(), initial);
    for (const change of ['revoked', 'viewer', 'session-version', 'service-archived', 'asset-quarantined', 'asset-owner']) {
      const before = await snapshot(); let pending;
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = post().then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true, 'Direct Stream attachment must wait after initial request access');
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else if (change === 'service-archived') await tx.service.update({ where: { id: `s${id}` }, data: { archivedAt: new Date() } });
          else if (change === 'asset-quarantined') await tx.workspaceAsset.update({ where: { id: asset.id }, data: { status: 'QUARANTINED' } });
          else if (change === 'asset-owner') await tx.workspaceAsset.update({ where: { id: asset.id }, data: { workspaceId: other } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = change.startsWith('asset-') ? 400 : change === 'service-archived' ? 409 : 403;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), before);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, mediaUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.service.update({ where: { id: `s${id}` }, data: { archivedAt: null } });
        await db.workspaceAsset.update({ where: { id: asset.id }, data: { workspaceId: asset.workspaceId, status: asset.status } });
      }
    }
    const beforeFailure = await snapshot();
    await db.$executeRawUnsafe(`CREATE FUNCTION packet63_reject_media() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic media failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet63_reject_media BEFORE INSERT ON "Media" FOR EACH ROW EXECUTE FUNCTION packet63_reject_media()`);
      assert.equal((await post()).status, 500); assert.deepEqual(await snapshot(), beforeFailure);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet63_reject_media ON "Media"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet63_reject_media()`);
    }
    const foreignBefore = await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } });
    const responses = await Promise.all([post(), post()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
    const rows = await db.media.findMany({ where: { projectId: `p${id}`, provider: 'CLOUDFLARE_STREAM', externalId: uid } });
    assert.equal(rows.length, 1); assert.equal(rows[0].assetId, asset.id);
    assert.deepEqual(await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } }), foreignBefore);
    try {
      await db.workspaceAsset.update({ where: { id: asset.id }, data: { status: 'QUARANTINED' } });
      const before = await snapshot(); assert.equal((await post()).status, 400); assert.deepEqual(await snapshot(), before);
    } finally { await db.workspaceAsset.update({ where: { id: asset.id }, data: { status: asset.status } }); }
    if (mode === 'external') {
      const url = `https://www.youtube.com/watch?v=${id.repeat(11)}`;
      const youtube = () => http(origin, `${other}.example.test`, `/api/admin/projects/p${id}/media`, { method: 'POST', headers: { cookie: driver.cookie(id) }, body: { externalUrl: url, originalFilename: 'Synthetic external video', mediaCategory: 'PHOTOGRAPHY', serviceId: `s${id}` } });
      const before = await snapshot(); let pending;
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = youtube().then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true);
          await tx.workspaceMembership.update({ where, data: { role: 'VIEWER' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, 403); assert.deepEqual(await snapshot(), before);
        races.push({ tenant: id, change: 'external-youtube-viewer', databaseWaitObserved: true, status: 403, mediaUnchanged: true });
      } finally { await pending; await db.workspaceMembership.update({ where, data: { role: 'OWNER' } }); }
      const responses = await Promise.all([youtube(), youtube()]); assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
      const rows = await db.media.findMany({ where: { projectId: `p${id}`, provider: 'YOUTUBE', externalId: id.repeat(11) } });
      assert.equal(rows.length, 1); assert.equal(rows[0].assetId, null);
    }
  }
  return { mode, races, foreignProjectAndUnknownUidDenied: true, concurrentRetrySingleMedia: true, assetLinkedBothDirections: true, duplicateRechecksAsset: true, failedInsertLeavesMediaUnchanged: true, provider: 'no-network Stream provisioning substitute; attachment makes no provider call', hosted: false };
}
