import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyTrustedLogoDelete(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async () => ({ logos: await db.trustedLogo.findMany({ orderBy: { id: 'asc' } }), assets: await db.workspaceAsset.findMany({ orderBy: { id: 'asc' } }) });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a', logoId = `packet73delete-${id}`;
    await db.trustedLogo.create({ data: { id: logoId, workspaceId: id, organizationName: 'Synthetic deletion', logoUrl: 'https://synthetic.example.test/logo.webp', logoStorageKey: `workspaces/${id}/trusted-logos/retained.webp` } });
    const remove = (selected = logoId) => http(origin, `${other}.example.test`, `/api/admin/trusted-logos?logoId=${selected}`, {
      method: 'DELETE', headers: { cookie: driver.cookie(id), 'x-workspace-id': other },
    });
    const initial = await snapshot();
    for (const denied of [`packet73status-${other}`, 'packet73status-unowned', 'missing']) assert.equal((await remove(denied)).status, 404);
    assert.deepEqual(await snapshot(), initial);
    for (const change of ['revoked', 'viewer', 'session-version', 'record-owner']) {
      let pending, afterChange;
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = remove().then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true);
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else if (change === 'record-owner') await tx.trustedLogo.update({ where: { id: logoId }, data: { workspaceId: other } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = { logos: await tx.trustedLogo.findMany({ orderBy: { id: 'asc' } }), assets: await tx.workspaceAsset.findMany({ orderBy: { id: 'asc' } }) };
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = change === 'record-owner' ? 404 : 403;
        assert.equal(outcome.response.status, expected); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, contentAndRegistryUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.trustedLogo.update({ where: { id: logoId }, data: { workspaceId: id } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet73delete_reject_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic logo delete failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet73delete_reject_delete AFTER DELETE ON "TrustedLogo" FOR EACH ROW EXECUTE FUNCTION packet73delete_reject_delete()`);
      const before = await snapshot(); assert.equal((await remove()).status, 500); assert.deepEqual(await snapshot(), before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet73delete_reject_delete ON "TrustedLogo"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet73delete_reject_delete()`);
    }
    const before = await snapshot();
    const responses = await Promise.all([remove(), remove()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 404]);
    assert.deepEqual(JSON.parse(responses.find(r => r.status === 200).text), { success: true, deletedLogoId: logoId, storageCleanupPending: true });
    const after = await snapshot();
    assert.deepEqual(after.logos, before.logos.filter(t => t.id !== logoId));
    assert.deepEqual(after.assets, before.assets);
    assert.equal((await remove()).status, 404); assert.deepEqual(await snapshot(), after);
  }
  return { races, foreignAndUnownedDenied: true, failedDeleteRollsBack: true, concurrentDeleteSingleWinner: true, retryInert: true, unrelatedContentAndRegistryRetained: true, providerCalls: false, hosted: false };
}
