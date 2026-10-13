import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyStreamUploadAdmission(origin, driver) {
  const db = driver.prisma, cases = [], metadataCases = [];
  const snapshot = () => db.workspaceAsset.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
    const post = (projectId = `p${id}`, metadata) => http(origin, `${other}.example.test`, `/api/admin/projects/${projectId}/stream-upload`, {
      method: 'POST', headers: { cookie: driver.cookie(id), 'upload-length': '100', 'tus-resumable': '1.0.0', 'x-workspace-id': other, ...(metadata === undefined ? {} : { 'upload-metadata': metadata }) },
    });
    for (const metadata of ['maxDurationSeconds OTk5', 'expiry eA==', 'requiresignedurls', 'allowedOrigins eA==', 'filename YQ==,filename Yg==', 'name !!!']) {
      const before = await snapshot(); const response = await post(`p${id}`, metadata);
      assert.equal(response.status, 400); assert.equal(response.headers.location, undefined);
      assert.deepEqual(await snapshot(), before);
      metadataCases.push({ tenant: id, rejected: metadata.split(' ')[0], status: 400, noAssetRegistered: true });
    }
    const descriptive = 'filename Y2Fmw6kubXA0,filetype dmlkZW8vbXA0,name,uploadPolicy c3RhbmRhcmQ=';
    assert.equal((await post(`p${id}`, descriptive)).status, 201);
    const deniedBefore = await snapshot();
    assert.equal((await post(`p${other}`)).status, 404);
    assert.deepEqual(await snapshot(), deniedBefore);
    const foreignBefore = await db.workspaceAsset.findMany({ where: { workspaceId: other }, orderBy: { id: 'asc' } });
    const success = await post(); assert.equal(success.status, 201);
    const uid = success.headers['stream-media-id'];
    assert.match(uid, /^[a-f0-9]{32}$/); assert.ok(success.headers.location.startsWith('https://synthetic-upload.invalid/'));
    // Provider is an explicit no-network substitute. Never follow the grant.
    const asset = await db.workspaceAsset.findFirst({ where: { provider: 'CLOUDFLARE_STREAM', providerKey: uid } });
    assert.equal(asset.workspaceId, id); assert.equal(asset.status, 'UPLOAD_PROVISIONED'); assert.equal(asset.byteSize, 100n);
    assert.equal(asset.providerNamespace, 'packet58-synthetic-account');
    assert.equal(asset.provenance.actorId, `u${id}`); assert.equal(asset.provenance.projectId, `p${id}`);
    assert.deepEqual(await db.workspaceAsset.findMany({ where: { workspaceId: other }, orderBy: { id: 'asc' } }), foreignBefore);
    for (const change of ['revoked', 'viewer', 'session-version']) {
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
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: change === 'viewer' ? 'VIEWER' : 'EDITOR' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, 403);
        assert.equal(outcome.response.headers.location, undefined); assert.equal(outcome.response.headers['stream-media-id'], undefined);
        assert.deepEqual(await snapshot(), before);
        cases.push({ tenant: id, change, databaseWaitObserved: true, status: outcome.response.status, noAssetRegistered: true, noUploadGrantReturned: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
      }
    }
    try {
      await db.workspaceMembership.update({ where, data: { role: 'EDITOR' } });
      assert.equal((await post()).status, 201);
      await db.workspaceMembership.update({ where, data: { role: 'VIEWER' } });
      assert.equal((await post()).status, 403);
    } finally { await db.workspaceMembership.update({ where, data: { role: 'OWNER' } }); }
  }
  assert.equal((await http(origin, 'a.example.test', '/api/admin/projects/pa/stream-upload', { method: 'POST', body: {} })).status, 401);
  return { cases, metadataCases, serverMetadataConstraintsVerified: true, serverOwnedKeysBothDirections: true, roleThresholdPreserved: true, anonymousRejected: true, provider: 'explicit no-network Stream provisioning substitute; no object transfer', hosted: false };
}
