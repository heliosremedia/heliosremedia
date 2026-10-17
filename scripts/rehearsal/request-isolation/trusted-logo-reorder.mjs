import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyTrustedLogoReorder(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = () => db.trustedLogo.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    await db.trustedLogo.createMany({ data: [0, 1].map(n => ({ id: `packet73reorder-${id}-${n}`, workspaceId: id, organizationName: 'Synthetic order', logoUrl: 'https://synthetic.example.test/logo.webp', displayOrder: n * 1000 })) });
    const original = await db.trustedLogo.findMany({ where: { workspaceId: id }, orderBy: { id: 'asc' } });
    const ids = original.map(t => t.id).reverse();
    const target = `packet73reorder-${id}-0`;
    const patch = (changes = {}) => http(origin, `${other}.example.test`, '/api/admin/trusted-logos', {
      method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other },
      body: { action: 'reorder', logoIds: ids, workspaceId: other, ...changes },
    });
    const initial = await snapshot();
    assert.equal((await patch({ logoIds: [`packet73status-${other}`, ...ids.slice(1)] })).status, 409);
    assert.equal((await patch({ logoIds: [ids[0], ...ids.slice(0, -1)] })).status, 409);
    assert.deepEqual(await snapshot(), initial);
    for (const change of ['revoked', 'viewer', 'session-version', 'inserted', 'record-owner']) {
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
          else if (change === 'inserted') await tx.trustedLogo.create({ data: { id: `packet73reorder-insert-${id}`, workspaceId: id, organizationName: 'Inserted', logoUrl: 'https://synthetic.example.test/inserted.webp' } });
          else if (change === 'record-owner') await tx.trustedLogo.update({ where: { id: target }, data: { workspaceId: other } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = await tx.trustedLogo.findMany({ orderBy: { id: 'asc' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = ['revoked', 'viewer', 'session-version'].includes(change) ? 403 : 409;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, deniedRequestLeavesRowsUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.trustedLogo.deleteMany({ where: { id: `packet73reorder-insert-${id}`, workspaceId: id } });
        await db.trustedLogo.update({ where: { id: target }, data: { workspaceId: id } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet73reorder_reject_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id LIKE 'packet73reorder-%-0' THEN RAISE EXCEPTION 'synthetic reorder failure'; END IF; RETURN NEW; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet73reorder_reject_order BEFORE UPDATE ON "TrustedLogo" FOR EACH ROW EXECUTE FUNCTION packet73reorder_reject_order()`);
      const before = await snapshot(); assert.equal((await patch()).status, 500); assert.deepEqual(await snapshot(), before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet73reorder_reject_order ON "TrustedLogo"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet73reorder_reject_order()`);
    }
    const before = await snapshot();
    const responses = await Promise.all([patch(), patch({ logoIds: [...ids].reverse() })]);
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    const saved = await db.trustedLogo.findMany({ where: { workspaceId: id }, orderBy: { displayOrder: 'asc' } });
    assert.ok(responses.some(r => JSON.stringify(JSON.parse(r.text).logoIds) === JSON.stringify(saved.map(t => t.id))));
    assert.deepEqual(saved.map(t => t.displayOrder), saved.map((_, i) => i));
    const after = await snapshot(); assert.deepEqual(after.filter(t => t.workspaceId !== id), before.filter(t => t.workspaceId !== id));
    assert.equal((await patch()).status, 200);
    assert.deepEqual((await db.trustedLogo.findMany({ where: { workspaceId: id }, orderBy: { displayOrder: 'asc' } })).map(t => t.id), ids);

  }
  return { races, foreignAndDuplicateDenied: true, partialOrderRollsBack: true, concurrentReorderSerialized: true, repeatOrderBothDirections: true, providerCalls: false, hosted: false };
}
