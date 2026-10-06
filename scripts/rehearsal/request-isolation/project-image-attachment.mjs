import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyProjectImageAttachment(origin, driver) {
  const db = driver.prisma, cases = [], races = [];
  const snapshot = () => db.media.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const uploadResponse = await http(origin, `${other}.example.test`, '/api/admin/r2/presign', { method: 'POST', headers: { cookie: driver.cookie(id) }, body: { projectId: `p${id}`, serviceId: `s${id}`, fileName: 'image.png', fileType: 'image/png', fileSize: 100 } });
    assert.equal(uploadResponse.status, 200);
    const { key } = JSON.parse(uploadResponse.text).upload;
    const asset = await db.workspaceAsset.findFirst({ where: { providerKey: key } });
    assert.ok(asset);
    const post = (imageKey = key, projectId = `p${id}`) => http(origin, `${other}.example.test`, `/api/admin/projects/${projectId}/media`, { method: 'POST', headers: { cookie: driver.cookie(id), 'x-workspace-id': other }, body: { key: imageKey, originalFilename: 'image.png', mimeType: 'image/png', fileSize: 100, serviceId: `s${id}`, workspaceId: other } });
    for (const [reason, data] of [
      ['foreign-owner', { workspaceId: other }],
      ['pending', { status: 'UPLOAD_PENDING' }], ['failed', { status: 'FAILED' }],
      ['quarantined', { status: 'QUARANTINED' }], ['retired', { status: 'RETIRED' }],
      ['foreign-project', { provenance: { ...asset.provenance, projectId: `p${other}` } }],
      ['wrong-kind', { provenance: { ...asset.provenance, kind: 'BRAND_UPLOAD' } }],
      ['wrong-namespace', { providerNamespace: 'foreign-provider' }],
    ]) {
      try {
        await db.workspaceAsset.update({ where: { id: asset.id }, data });
        const before = await snapshot(); const response = await post();
        assert.equal(response.status, 400, reason); assert.deepEqual(await snapshot(), before);
        cases.push({ tenant: id, reason, status: 400, mediaUnchanged: true });
      } finally {
        await db.workspaceAsset.update({ where: { id: asset.id }, data: { workspaceId: asset.workspaceId, status: asset.status, provenance: asset.provenance, providerNamespace: asset.providerNamespace } });
      }
    }
    const before = await snapshot();
    assert.equal((await post(key + '.unknown')).status, 400);
    assert.equal((await post(key, `p${other}`)).status, 404);
    assert.deepEqual(await snapshot(), before);
    for (const change of ['revoked', 'viewer', 'session-version', 'service-archived', 'asset-quarantined', 'asset-owner']) {
      const before = await snapshot();
      const linksBefore = await db.projectService.findMany({ orderBy: [{ projectId: 'asc' }, { serviceId: 'asc' }] });
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      let pending;
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
          assert.equal(observed, true, 'Attachment must wait after object inspection and before persistence');
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else if (change === 'service-archived') await tx.service.update({ where: { id: `s${id}` }, data: { archivedAt: new Date() } });
          else if (change === 'asset-quarantined') await tx.workspaceAsset.update({ where: { id: asset.id }, data: { status: 'QUARANTINED' } });
          else if (change === 'asset-owner') await tx.workspaceAsset.update({ where: { id: asset.id }, data: { workspaceId: other } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = change.startsWith('asset-') ? 400 : change === 'service-archived' ? 409 : 403;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), before);
        assert.deepEqual(await db.projectService.findMany({ orderBy: [{ projectId: 'asc' }, { serviceId: 'asc' }] }), linksBefore);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, mediaAndServiceLinksUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.service.update({ where: { id: `s${id}` }, data: { archivedAt: null } });
        await db.workspaceAsset.update({ where: { id: asset.id }, data: { workspaceId: asset.workspaceId, status: asset.status } });
      }
    }
    const rollbackBefore = await snapshot();
    await db.$executeRawUnsafe(`CREATE FUNCTION packet61_reject_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic association failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet61_reject_link BEFORE INSERT ON "ProjectService" FOR EACH ROW EXECUTE FUNCTION packet61_reject_link()`);
      assert.equal((await post()).status, 500);
      assert.deepEqual(await snapshot(), rollbackBefore, 'A failed service association must roll back the new media row');
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet61_reject_link ON "ProjectService"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet61_reject_link()`);
    }
    const foreignBefore = await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } });
    const success = await post(); assert.equal(success.status, 201);
    const media = await db.media.findUnique({ where: { id: JSON.parse(success.text).media.id } });
    assert.equal(media.assetId, asset.id); assert.equal(media.projectId, `p${id}`); assert.equal(media.storageKey, key);
    assert.equal((await post()).status, 200);
    assert.equal(await db.media.count({ where: { projectId: `p${id}`, storageKey: key } }), 1);
    assert.deepEqual(await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } }), foreignBefore);
  }
  return { cases, races, serviceFailureRollsBackMedia: true, unknownAndForeignProjectDenied: true, assetLinkedBothDirections: true, retryNoDuplicate: true, provider: 'explicit no-network HeadObject substitute; no object transfer', hosted: false };
}
