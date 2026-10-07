import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyTeamMemberReorder(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = () => db.teamMember.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) await db.teamMember.create({ data: { id: `packet75anchor-${id}`, workspaceId: id, name: 'Synthetic anchor', title: 'Synthetic title', biography: 'Synthetic biography' } });
  await db.teamMember.create({ data: { id: 'packet75anchor-unowned', workspaceId: null, name: 'Unowned', title: 'Synthetic title', biography: 'Synthetic biography' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    await db.teamMember.createMany({ data: [0, 1].map(n => ({ id: `packet75reorder-${id}-${n}`, workspaceId: id, name: 'Synthetic order', title: 'Synthetic title', biography: 'Synthetic biography', portraitUrl: 'https://synthetic.example.test/logo.webp', displayOrder: n * 1000 })) });
    const original = await db.teamMember.findMany({ where: { workspaceId: id }, orderBy: { id: 'asc' } });
    const ids = original.map(t => t.id).reverse();
    const target = `packet75reorder-${id}-0`;
    const patch = (changes = {}) => http(origin, `${other}.example.test`, '/api/admin/team-members', {
      method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other },
      body: { action: 'reorder', teamMemberIds: ids, workspaceId: other, ...changes },
    });
    const initial = await snapshot();
    assert.equal((await patch({ teamMemberIds: [`packet75anchor-${other}`, ...ids.slice(1)] })).status, 409);
    assert.equal((await patch({ teamMemberIds: [ids[0], ...ids.slice(0, -1)] })).status, 409);
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
          else if (change === 'inserted') await tx.teamMember.create({ data: { id: `packet75reorder-insert-${id}`, workspaceId: id, name: 'Inserted', title: 'Synthetic title', biography: 'Inserted biography', portraitUrl: 'https://synthetic.example.test/inserted.webp' } });
          else if (change === 'record-owner') await tx.teamMember.update({ where: { id: target }, data: { workspaceId: other } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = await tx.teamMember.findMany({ orderBy: { id: 'asc' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = ['revoked', 'viewer', 'session-version'].includes(change) ? 403 : 409;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, deniedRequestLeavesRowsUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.teamMember.deleteMany({ where: { id: `packet75reorder-insert-${id}`, workspaceId: id } });
        await db.teamMember.update({ where: { id: target }, data: { workspaceId: id } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet75reorder_reject_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id LIKE 'packet75reorder-%-0' THEN RAISE EXCEPTION 'synthetic reorder failure'; END IF; RETURN NEW; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet75reorder_reject_order BEFORE UPDATE ON "TeamMember" FOR EACH ROW EXECUTE FUNCTION packet75reorder_reject_order()`);
      const before = await snapshot(); assert.equal((await patch()).status, 500); assert.deepEqual(await snapshot(), before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet75reorder_reject_order ON "TeamMember"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet75reorder_reject_order()`);
    }
    const before = await snapshot();
    const responses = await Promise.all([patch(), patch({ teamMemberIds: [...ids].reverse() })]);
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    const saved = await db.teamMember.findMany({ where: { workspaceId: id }, orderBy: { displayOrder: 'asc' } });
    assert.ok(responses.some(r => JSON.stringify(JSON.parse(r.text).teamMemberIds) === JSON.stringify(saved.map(t => t.id))));
    assert.deepEqual(saved.map(t => t.displayOrder), saved.map((_, i) => i));
    const after = await snapshot(); assert.deepEqual(after.filter(t => t.workspaceId !== id), before.filter(t => t.workspaceId !== id));
    assert.equal((await patch()).status, 200);
    assert.deepEqual((await db.teamMember.findMany({ where: { workspaceId: id }, orderBy: { displayOrder: 'asc' } })).map(t => t.id), ids);

  }
  return { races, foreignAndDuplicateDenied: true, partialOrderRollsBack: true, concurrentReorderSerialized: true, repeatOrderBothDirections: true, providerCalls: false, hosted: false };
}
