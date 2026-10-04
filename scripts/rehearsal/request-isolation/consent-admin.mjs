import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyConsentAdmin(origin, driver) {
  const db = driver.prisma, cases = [];
  for (const [index, id] of ['a', 'b', 'shared'].entries()) await db.communicationClient.create({ data: {
    id: `consent-${id}`, hdPhotoHubUserId: 38001 + index, firstName: 'Synthetic', lastName: id, displayName: `Consent ${id}`,
    email: 'consent-shared@example.test', normalizedEmail: 'consent-shared@example.test', lastSyncedAt: new Date(),
    workspaceMemberships: { create: (id === 'shared' ? ['a', 'b'] : [id]).map(workspaceId => ({ workspaceId })) },
  } });
  await db.marketingEmailPreference.create({ data: { normalizedEmail: 'consent-shared@example.test', status: 'SUPPRESSED', source: 'SYNTHETIC_SAFETY' } });
  await db.communicationSuppression.create({ data: { normalizedEmail: 'consent-shared@example.test', reason: 'SYNTHETIC_SAFETY' } });
  const snapshot = async () => {
    const result = {};
    for (const model of ['communicationClient', 'marketingEmailPreference', 'marketingEmailPreferenceEvent', 'communicationGroupMembership', 'communicationSuppression', 'auditEvent']) result[model] = await db[model].findMany({ orderBy: { id: 'asc' } });
    return result;
  };
  const before = await snapshot();
  const send = (id, clientId, action = 'resubscribe') => http(origin, `${id}.example.test`, '/api/admin/clients/preferences', {
    method: 'POST', headers: { cookie: driver.cookie(id) }, body: { clientId, action, confirmation: true, consentSource: 'Synthetic', workspaceId: id === 'a' ? 'b' : 'a' },
  });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    for (const action of ['unsubscribe', 'resubscribe']) {
      assert.equal((await send(id, `consent-${other}`, action)).status, 404);
      assert.equal((await send(id, `consent-${id}`, action)).status, 409);
      assert.equal((await send(id, 'consent-shared', action)).status, 409);
      assert.deepEqual(await snapshot(), before);
    }
    for (const change of ['revoked', 'demoted']) {
      let pending;
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = send(id, `consent-${id}`).then(response => ({ response }), error => ({ error }));
          const deadline = Date.now() + 8000; let blocked = false;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { blocked = true; break; } await delay(25);
          }
          assert.equal(blocked, true, 'Consent request must wait after its initial session read');
          await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'EDITOR' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, 403, outcome.response.text); assert.deepEqual(await snapshot(), before);
        cases.push({ tenant: id, change, databaseWaitObserved: true, currentAccessRejected403: true, allConsentAndAuditRowsUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { status: 'ACTIVE', role: 'OWNER' } });
      }
    }
  }
  return { cases, foreignClients404BothDirections: true, ownedAndSharedClients409BothDirections: true, globalSafetyAndPreferencesUnchanged: true,
    bothActionsCovered: true, membershipRestored: true, legacyCompatibility: 'module-level adapters only', providerCalls: false };
}
