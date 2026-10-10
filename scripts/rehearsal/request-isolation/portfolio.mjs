import assert from 'node:assert/strict';
import { http } from './http.mjs';

export async function qualifyPortfolio(origin, driver) {
  const results = [];
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const path = `/portfolio/packet19-project-${id}`;
    const endpoint = `/api/admin/projects/p${id}/previews`;
    const cookie = driver.cookie(id);
    const headers = { cookie };
    const marker = `PACKET20 PRIVATE CONTENT ${id}`;
    await driver.prisma.project.update({ where: { id: `p${id}` }, data: { title: marker } });
    const own = await http(origin, `${id}.example.test`, path);
    assert.equal(own.status, 200); assert.ok(own.text.includes(marker));
    const foreign = await http(origin, `${other}.example.test`, path);
    assert.equal(foreign.status, 404); assert.ok(!foreign.text.includes(marker));
    const countBefore = await driver.prisma.projectPreviewLink.count();
    assert.equal((await http(origin, `${other}.example.test`, endpoint, { method: 'POST', headers: { cookie: driver.cookie(other) }, body: { days: 1 } })).status, 404);
    assert.equal(await driver.prisma.projectPreviewLink.count(), countBefore);
    await driver.prisma.project.update({ where: { id: `p${id}` }, data: { status: 'DRAFT' } });
    try {
      const draft = await http(origin, `${id}.example.test`, path);
      assert.equal(draft.status, 404); assert.ok(!draft.text.includes(marker));
      // Create through the actual authenticated route; do not fabricate a preview token.
      const created = await http(origin, `${other}.example.test`, endpoint, { method: 'POST', headers, body: { days: 1 } });
      assert.equal(created.status, 201);
      const preview = JSON.parse(created.text).preview; const url = new URL(preview.url);
      assert.equal(url.hostname, `${id}.example.test`); assert.equal(url.pathname, path);
      const token = url.searchParams.get('preview'); assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      const previewPath = url.pathname + url.search;
      const row = () => driver.prisma.projectPreviewLink.findUniqueOrThrow({ where: { id: preview.id } });
      assert.equal((await row()).lastUsedAt, null);
      const foreignPreview = await http(origin, `${other}.example.test`, previewPath);
      assert.equal(foreignPreview.status, 404); assert.ok(!foreignPreview.text.includes(marker));
      assert.equal((await row()).lastUsedAt, null, 'foreign-host denial must not touch the preview');
      const permitted = await http(origin, `${id}.example.test`, previewPath);
      assert.equal(permitted.status, 200); assert.ok(permitted.text.includes(marker));
      assert.ok(permitted.text.includes('Private preview')); assert.match(permitted.text, /name="robots" content="noindex, nofollow"/);
      assert.ok((await row()).lastUsedAt instanceof Date);
      const beforeForeignDelete = await row();
      assert.equal((await http(origin, `${other}.example.test`, `${endpoint}?previewId=${preview.id}`, { method: 'DELETE', headers: { cookie: driver.cookie(other) } })).status, 404);
      assert.deepEqual(await row(), beforeForeignDelete);
      assert.equal((await http(origin, `${other}.example.test`, `${endpoint}?previewId=${preview.id}`, { method: 'DELETE', headers })).status, 200);
      const revokedRow = await row(); assert.ok(revokedRow.revokedAt instanceof Date);
      const revoked = await http(origin, `${id}.example.test`, previewPath);
      assert.equal(revoked.status, 404); assert.ok(!revoked.text.includes(marker));
      assert.deepEqual(await row(), revokedRow, 'revoked-token denial must not update usage');
      const second = await http(origin, `${id}.example.test`, endpoint, { method: 'POST', headers, body: { days: 1 } });
      assert.equal(second.status, 201); const expiring = JSON.parse(second.text).preview; const expiredUrl = new URL(expiring.url);
      await driver.prisma.projectPreviewLink.update({ where: { id: expiring.id }, data: { expiresAt: new Date('2000-01-01T00:00:00Z') } });
      const expired = await http(origin, `${id}.example.test`, expiredUrl.pathname + expiredUrl.search);
      assert.equal(expired.status, 404); assert.ok(!expired.text.includes(marker));
      assert.equal((await driver.prisma.projectPreviewLink.findUniqueOrThrow({ where: { id: expiring.id } })).lastUsedAt, null);
      results.push({ tenant: id, ownPublished: 200, foreignPublished: 404, draftWithoutToken: 404,
        create: 201, foreignCreate: 404, ownPreview: 200, foreignPreview: 404, foreignRevoke: 404, revoke: 200, revokedPreview: 404, expiredPreview: 404, noForeignOrRejectedUsageWrite: true });
    } finally {
      await driver.prisma.project.update({ where: { id: `p${id}` }, data: { status: 'PUBLISHED', title: 'Shared project title' } });
    }
  }
  return results;
}
