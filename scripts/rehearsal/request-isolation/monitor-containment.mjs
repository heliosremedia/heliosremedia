import assert from 'node:assert/strict';
import { http } from './http.mjs';

export async function qualifyMonitorContainment(origin, driver) {
  const cases = [];
  const read = id => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, '/admin?range=7', { headers: { cookie: driver.cookie(id) } });
  const redacted = reply => { assert.equal(reply.status, 200); assert.ok(reply.text.includes('Public Website')); assert.ok(reply.text.includes('not configured')); assert.doesNotMatch(reply.text, /987654321|PRIVATE_PLATFORM_MONITOR|PRIVATE_PLATFORM_INCIDENT/); };
  for (const id of ['a', 'b', 'a', 'b']) redacted(await read(id));
  for (const reply of await Promise.all(['a', 'b'].map(read))) redacted(reply);
  const anonymous = await http(origin, 'a.example.test', '/admin'); assert.equal(anonymous.status, 307); assert.doesNotMatch(anonymous.text, /987654321|PRIVATE_PLATFORM/);
  for (const id of ['a', 'b']) {
    const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
    try {
      await driver.prisma.workspaceMembership.update({ where, data: { status: 'REVOKED' } });
      const revoked = await read(id); assert.equal(revoked.status, 307); assert.doesNotMatch(revoked.text, /987654321|PRIVATE_PLATFORM/);
    } finally { await driver.prisma.workspaceMembership.update({ where, data: { status: 'ACTIVE' } }); }
    redacted(await read(id)); cases.push({ tenant: id, authenticatedDashboardRead: true, forgedHostCannotSelectPlatformMonitor: true, platformSummaryAbsent: true, revokedSessionRejected: true, membershipRestored: true });
  }
  return { cases, alternatingAndConcurrentReads: true, anonymousRejected: true, provider: 'synthetic monitor fetch substitution; no network fallback', hosted: false };
}
