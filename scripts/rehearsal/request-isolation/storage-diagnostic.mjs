import assert from 'node:assert/strict';
import { http } from './http.mjs';

export async function qualifyStorageDiagnostic(origin, driver) {
  const cases = [];
  const before = await driver.prisma.workspaceAsset.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) {
    const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
    const read = () => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, '/api/admin/r2/verify', { headers: { cookie: driver.cookie(id) } });
    const denied = response => { assert.equal(response.status, 403); assert.equal(JSON.parse(response.text).checks, undefined); assert.doesNotMatch(response.text, /PRIVATE_PLATFORM|credentials|bucket|endpoint/); };
    for (const role of ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']) {
      try { await driver.prisma.workspaceMembership.update({ where, data: { role } }); denied(await read()); }
      finally { await driver.prisma.workspaceMembership.update({ where, data: { role: 'OWNER' } }); }
    }
    try { await driver.prisma.workspaceMembership.update({ where, data: { status: 'REVOKED' } }); denied(await read()); }
    finally { await driver.prisma.workspaceMembership.update({ where, data: { status: 'ACTIVE' } }); }
    try { await driver.prisma.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } }); denied(await read()); }
    finally { await driver.prisma.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } }); }
    cases.push({ tenant: id, allTenantRolesDenied: true, revokedDenied: true, invalidSessionDenied: true, noDiagnosticFields: true });
  }
  assert.equal((await http(origin, 'a.example.test', '/api/admin/r2/verify')).status, 401);
  assert.deepEqual(await driver.prisma.workspaceAsset.findMany({ orderBy: { id: 'asc' } }), before);
  return { cases, assetsUnchanged: true, anonymousRejected: true, provider: 'explicit diagnostic-only no-network substitute', hosted: false };
}
