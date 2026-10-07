import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyTrustedLogoStatus(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = () => db.trustedLogo.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) await db.trustedLogo.create({ data: { id: `packet73status-${id}`, workspaceId: id, organizationName: `Synthetic ${id}`, logoUrl: 'https://synthetic.example.test/logo.webp', published: false } });
  await db.trustedLogo.create({ data: { id: 'packet73status-unowned', workspaceId: null, organizationName: 'Unowned', logoUrl: 'https://synthetic.example.test/legacy.webp' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a', logoId = `packet73status-${id}`;
    const patch = (changes = {}) => http(origin, `${other}.example.test`, '/api/admin/trusted-logos', {
      method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other },
      body: { action: 'set-published', logoId, published: true, workspaceId: other, ...changes },
    });
    const initial = await snapshot();
    for (const denied of [`packet73status-${other}`, 'packet73status-unowned', 'missing']) assert.equal((await patch({ logoId: denied })).status, 404);
    assert.deepEqual(await snapshot(), initial);
    for (const change of ['revoked', 'viewer', 'session-version', 'record-owner']) {
      let pending, afterChange;
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = patch().then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true);
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else if (change === 'record-owner') await tx.trustedLogo.update({ where: { id: logoId }, data: { workspaceId: other } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = await tx.trustedLogo.findMany({ orderBy: { id: 'asc' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = change === 'record-owner' ? 404 : 403;
        assert.equal(outcome.response.status, expected); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, deniedRequestLeavesRowsUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.trustedLogo.update({ where: { id: logoId }, data: { workspaceId: id } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet73status_reject_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic status failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet73status_reject_status AFTER UPDATE ON "TrustedLogo" FOR EACH ROW EXECUTE FUNCTION packet73status_reject_status()`);
      const before = await snapshot(); assert.equal((await patch()).status, 500); assert.deepEqual(await snapshot(), before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet73status_reject_status ON "TrustedLogo"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet73status_reject_status()`);
    }
    const before = await snapshot();
    const success = await patch(); assert.equal(success.status, 200);
    const saved = await db.trustedLogo.findUnique({ where: { id: logoId } });
    assert.equal(saved.published, true);
    assert.equal(JSON.parse(success.text).logo.id, logoId);
    assert.equal(saved.organizationName, `Synthetic ${id}`); assert.equal(saved.logoUrl, 'https://synthetic.example.test/logo.webp');
    assert.equal((await patch({ published: false })).status, 200);
    const cleared = await db.trustedLogo.findUnique({ where: { id: logoId } });
    assert.equal(cleared.published, false);
    assert.deepEqual((await snapshot()).filter(t => t.id !== logoId), before.filter(t => t.id !== logoId));
  }
  return { races, foreignAndUnownedDenied: true, failedStatusRollsBack: true, ownedPublishAndUnpublishBothDirections: true, unrelatedContentPreserved: true, providerCalls: false, hosted: false };
}
