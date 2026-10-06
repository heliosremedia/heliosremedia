import assert from 'node:assert/strict';
import { http } from './http.mjs';

export async function qualifyProjectImageAttachment(origin, driver) {
  const db = driver.prisma, cases = [];
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
    const foreignBefore = await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } });
    const success = await post(); assert.equal(success.status, 201);
    const media = await db.media.findUnique({ where: { id: JSON.parse(success.text).media.id } });
    assert.equal(media.assetId, asset.id); assert.equal(media.projectId, `p${id}`); assert.equal(media.storageKey, key);
    assert.equal((await post()).status, 200);
    assert.equal(await db.media.count({ where: { projectId: `p${id}`, storageKey: key } }), 1);
    assert.deepEqual(await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } }), foreignBefore);
  }
  return { cases, unknownAndForeignProjectDenied: true, assetLinkedBothDirections: true, retryNoDuplicate: true, provider: 'explicit no-network HeadObject substitute; no object transfer', hosted: false };
}
