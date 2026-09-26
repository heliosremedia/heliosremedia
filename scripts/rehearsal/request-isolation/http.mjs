import assert from 'node:assert/strict';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { requireOrigin } from './safety.mjs';

export function http(origin, host, path = '/', options = {}) {
  requireOrigin(origin);
  assert.ok(['a.example.test', 'b.example.test', 'unknown.example.test'].includes(host));
  assert.ok(path.startsWith('/') && !path.startsWith('//'));
  return new Promise((resolve, reject) => {
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = request(origin + path, { method: options.method || 'GET', timeout: 60000,
      headers: { ...options.headers, host, ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}) } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
      res.on('error', reject); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Isolated HTTP timeout'))); req.end(body);
  });
}
export async function qualify(origin, driver) {
  const results = [];
  const publicRead = async id => {
    const response = await http(origin, `${id}.example.test`, '/', { headers: { 'x-forwarded-host': `${id === 'a' ? 'b' : 'a'}.example.test`, 'x-workspace-id': id === 'a' ? 'b' : 'a' } });
    assert.equal(response.status, 200);
    assert.ok(response.text.includes(`PACKET19 COMPANY ${id}`));
    assert.ok(!response.text.includes(`PACKET19 COMPANY ${id === 'a' ? 'b' : 'a'}`));
    return response;
  };
  for (const id of ['a', 'b', 'a', 'b']) await publicRead(id);
  await Promise.all(['b', 'a', 'b', 'a'].map(publicRead));
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const cookie = driver.cookie(id);
    const before = await driver.snapshot(id); const untouched = await driver.snapshot(other);
    const patch = (placementId, revision, title) => http(origin, `${other}.example.test`, '/api/admin/homepage-projects', {
      method: 'PATCH', headers: { cookie, 'x-curation-revision': revision, 'x-curation-request': randomUUID() }, body: { placementId, titleOverride: title },
    });
    assert.equal((await patch(`hp${other}`, before.revision, 'Forbidden')).status, 404);
    const write = await patch(`hp${id}`, before.revision, `PACKET19 UPDATED ${id}`);
    assert.equal(write.status, 200);
    const after = await driver.snapshot(id); const ack = JSON.parse(write.text).acknowledgement;
    assert.equal(ack.workspaceId, id); assert.equal(ack.revision, after.revision); assert.notEqual(after.revision, before.revision);
    assert.equal(after.rows[0].titleOverride, `PACKET19 UPDATED ${id}`);
    assert.deepEqual(await driver.snapshot(other), untouched);
    assert.ok((await publicRead(id)).text.includes(`PACKET19 UPDATED ${id}`));
    assert.ok(!(await publicRead(other)).text.includes(`PACKET19 UPDATED ${id}`));
    assert.equal((await patch(`hp${id}`, before.revision, 'Stale')).status, 409);
    const admin = await http(origin, `${other}.example.test`, '/admin/homepage', { headers: { cookie } });
    assert.equal(admin.status, 200); assert.ok(admin.text.includes(`hp${id}`)); assert.ok(!admin.text.includes(`hp${other}`));
    // Same signed cookie, fresh database membership. No bypass route is installed.
    await driver.prisma.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { status: 'REVOKED' } });
    try {
      const revoked = await http(origin, `${id}.example.test`, '/admin/homepage', { headers: { cookie } });
      assert.equal(revoked.status, 307); assert.ok(revoked.headers.location?.startsWith('/login'));
      assert.equal((await patch(`hp${id}`, after.revision, 'Revoked write')).status, 403);
      assert.deepEqual(await driver.snapshot(id), after);
      assert.equal((await http(origin, `${id}.example.test`, '/admin/homepage', { headers: { cookie: driver.cookie(other) } })).status, 200);
    } finally {
      await driver.prisma.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { status: 'ACTIVE' } });
    }
    await driver.prisma.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
    try { assert.equal((await http(origin, `${id}.example.test`, '/admin/homepage', { headers: { cookie } })).status, 307); }
    finally { await driver.prisma.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } }); }
    results.push({ tenant: id, publicReads: true, postWriteRead: true, foreignWrite: 404, staleWrite: 409, revokedRead: 307, revokedWrite: 403, staleSession: 307 });
  }
  const unknown = await http(origin, 'unknown.example.test');
  assert.equal(unknown.status, 500);
  assert.ok(!unknown.text.includes('PACKET19 COMPANY a') && !unknown.text.includes('PACKET19 COMPANY b'));
  assert.equal((await http(origin, 'a.example.test', '/api/admin/homepage-projects', { method: 'PATCH', body: {} })).status, 401);
  return { alternatingReads: true, concurrentReads: true, unknownHost: 500, anonymousWrite: 401, tenants: results };
}
