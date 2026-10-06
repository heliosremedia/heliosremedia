import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyBrandUploadAdmission(origin, driver) {
  const db = driver.prisma, cases = [];
  const snapshot = () => db.workspaceAsset.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
    const post = (admin = false) => http(origin, `${other}.example.test`, admin ? '/api/admin/site-settings/brand-logo/presign' : '/api/admin/about/presign', {
      method: 'POST', headers: { cookie: driver.cookie(id) }, body: { kind: 'hero', fileType: 'image/png', fileSize: 100, workspaceId: other, key: `workspaces/${other}/about/forged.png` },
    });
    const foreignBefore = await db.workspaceAsset.findMany({ where: { workspaceId: other }, orderBy: { id: 'asc' } });
    const success = await post(); assert.equal(success.status, 200);
    const upload = JSON.parse(success.text).upload;
    assert.ok(upload.key.startsWith(`workspaces/${id}/about/`)); assert.equal(typeof upload.uploadUrl, 'string');
    // Signing is local with fixed synthetic R2 credentials. Never follow or record the URL.
    const asset = await db.workspaceAsset.findFirst({ where: { providerKey: upload.key } });
    assert.equal(asset.workspaceId, id); assert.equal(asset.status, 'UPLOAD_PROVISIONED'); assert.equal(asset.byteSize, 100n);
    assert.equal(asset.provenance.actorId, `u${id}`);
    assert.deepEqual(await db.workspaceAsset.findMany({ where: { workspaceId: other }, orderBy: { id: 'asc' } }), foreignBefore);
    for (const change of ['revoked', 'viewer', 'admin-demotion', 'session-version']) {
      const before = await snapshot(); let pending;
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = post(change === 'admin-demotion').then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true, 'Upload must wait after initial session resolution');
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: change === 'viewer' ? 'VIEWER' : 'EDITOR' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, 403);
        assert.equal(JSON.parse(outcome.response.text).upload, undefined);
        assert.deepEqual(await snapshot(), before);
        cases.push({ tenant: id, change, databaseWaitObserved: true, status: 403, noAssetRegistered: true, noUploadGrantReturned: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
      }
    }
    try {
      await db.workspaceMembership.update({ where, data: { role: 'EDITOR' } });
      assert.equal((await post()).status, 200); assert.equal((await post(true)).status, 403);
    } finally { await db.workspaceMembership.update({ where, data: { role: 'OWNER' } }); }
  }
  assert.equal((await http(origin, 'a.example.test', '/api/admin/about/presign', { method: 'POST', body: {} })).status, 401);
  return { cases, serverOwnedKeysBothDirections: true, editorThresholdPreserved: true, anonymousRejected: true, provider: 'local signing with synthetic credentials; no object request', hosted: false };
}
