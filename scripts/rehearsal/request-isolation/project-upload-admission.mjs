import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyProjectUploadAdmission(origin, driver) {
  const db = driver.prisma, cases = [];
  const snapshot = () => db.workspaceAsset.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
    const post = (body = {}) => http(origin, `${other}.example.test`, '/api/admin/r2/presign', {
      method: 'POST', headers: { cookie: driver.cookie(id) }, body: { projectId: `p${id}`, serviceId: `s${id}`, fileName: 'image.png', fileType: 'image/png', fileSize: 100, workspaceId: other, key: `projects/p${other}/forged.png`, ...body },
    });
    const deniedBefore = await snapshot();
    assert.equal((await post({ projectId: `p${other}` })).status, 404);
    assert.equal((await post({ serviceId: `s${other}` })).status, 409);
    assert.deepEqual(await snapshot(), deniedBefore);
    const foreignBefore = await db.workspaceAsset.findMany({ where: { workspaceId: other }, orderBy: { id: 'asc' } });
    const success = await post(); assert.equal(success.status, 200);
    const upload = JSON.parse(success.text).upload;
    assert.ok(upload.key.startsWith(`projects/p${id}/`)); assert.equal(typeof upload.uploadUrl, 'string');
    // Signing is local with fixed synthetic R2 credentials. Never follow or record the URL.
    const asset = await db.workspaceAsset.findFirst({ where: { providerKey: upload.key } });
    assert.equal(asset.workspaceId, id); assert.equal(asset.status, 'UPLOAD_PROVISIONED'); assert.equal(asset.byteSize, 100n);
    assert.equal(asset.provenance.actorId, `u${id}`); assert.equal(asset.provenance.projectId, `p${id}`); assert.equal(asset.provenance.serviceId, `s${id}`);
    assert.deepEqual(await db.workspaceAsset.findMany({ where: { workspaceId: other }, orderBy: { id: 'asc' } }), foreignBefore);
    for (const change of ['revoked', 'viewer', 'session-version', 'service-archived']) {
      const before = await snapshot(); let pending;
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
          assert.equal(observed, true, 'Upload must wait after initial session resolution');
          if (change === 'service-archived') await tx.service.update({ where: { id: `s${id}` }, data: { archivedAt: new Date() } });
          else if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: change === 'viewer' ? 'VIEWER' : 'EDITOR' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, change === 'service-archived' ? 409 : 403);
        assert.equal(JSON.parse(outcome.response.text).upload, undefined);
        assert.deepEqual(await snapshot(), before);
        cases.push({ tenant: id, change, databaseWaitObserved: true, status: outcome.response.status, noAssetRegistered: true, noUploadGrantReturned: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.service.update({ where: { id: `s${id}` }, data: { archivedAt: null } });
      }
    }
    try {
      await db.workspaceMembership.update({ where, data: { role: 'EDITOR' } });
      assert.equal((await post()).status, 200); assert.equal((await post({ serviceId: '' })).status, 200);
      await db.workspaceMembership.update({ where, data: { role: 'VIEWER' } });
      assert.equal((await post()).status, 403);
    } finally { await db.workspaceMembership.update({ where, data: { role: 'OWNER' } }); }
  }
  assert.equal((await http(origin, 'a.example.test', '/api/admin/r2/presign', { method: 'POST', body: {} })).status, 401);
  return { cases, serverOwnedKeysBothDirections: true, roleThresholdPreserved: true, anonymousRejected: true, provider: 'local signing with synthetic credentials; no object request', hosted: false };
}
