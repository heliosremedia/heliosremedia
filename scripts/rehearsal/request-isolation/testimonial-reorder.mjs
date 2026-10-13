import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyTestimonialReorder(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = () => db.testimonial.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    await db.testimonial.createMany({ data: [0, 1].map(n => ({ id: `packet70-${id}-${n}`, workspaceId: id, agentName: 'Synthetic order', testimonial: 'Synthetic order only', displayOrder: n * 1000 })) });
    const original = await db.testimonial.findMany({ where: { workspaceId: id }, orderBy: { id: 'asc' } });
    const ids = original.map(t => t.id).reverse(), versions = Object.fromEntries(original.map(t => [t.id, t.rowVersion]));
    const target = `packet70-${id}-0`;
    const patch = (changes = {}) => http(origin, `${other}.example.test`, '/api/admin/testimonials', {
      method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other },
      body: { action: 'reorder', testimonialIds: ids, versions, workspaceId: other, ...changes },
    });
    const initial = await snapshot();
    assert.equal((await patch({ testimonialIds: [`packet69-${other}`, ...ids.slice(1)] })).status, 409);
    assert.equal((await patch({ testimonialIds: [ids[0], ...ids.slice(0, -1)] })).status, 409);
    assert.deepEqual(await snapshot(), initial);
    for (const change of ['revoked', 'viewer', 'session-version', 'inserted', 'record-owner', 'row-version']) {
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
          else if (change === 'inserted') await tx.testimonial.create({ data: { id: `packet70-insert-${id}`, workspaceId: id, agentName: 'Inserted', testimonial: 'Inserted during request' } });
          else if (change === 'record-owner') await tx.testimonial.update({ where: { id: target }, data: { workspaceId: other } });
          else if (change === 'row-version') await tx.testimonial.update({ where: { id: target }, data: { rowVersion: { increment: 1 } } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = await tx.testimonial.findMany({ orderBy: { id: 'asc' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = ['revoked', 'viewer', 'session-version'].includes(change) ? 403 : 409;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, deniedRequestLeavesRowsUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.testimonial.deleteMany({ where: { id: `packet70-insert-${id}`, workspaceId: id } });
        await db.testimonial.update({ where: { id: target }, data: { workspaceId: id, rowVersion: versions[target] } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet70_reject_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id LIKE 'packet70-%-0' THEN RAISE EXCEPTION 'synthetic reorder failure'; END IF; RETURN NEW; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet70_reject_order BEFORE UPDATE ON "Testimonial" FOR EACH ROW EXECUTE FUNCTION packet70_reject_order()`);
      const before = await snapshot(); assert.equal((await patch()).status, 500); assert.deepEqual(await snapshot(), before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet70_reject_order ON "Testimonial"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet70_reject_order()`);
    }
    const before = await snapshot();
    const responses = await Promise.all([patch(), patch({ testimonialIds: [...ids].reverse() })]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const winner = JSON.parse(responses.find(r => r.status === 200).text);
    const saved = await db.testimonial.findMany({ where: { workspaceId: id }, orderBy: { displayOrder: 'asc' } });
    assert.deepEqual(saved.map(t => t.id), winner.testimonialIds);
    assert.deepEqual(saved.map(t => t.displayOrder), saved.map((_, i) => i * 1000));
    assert.ok(saved.every(t => t.rowVersion === versions[t.id] + 1 && winner.versions[t.id] === t.rowVersion));
    const after = await snapshot(); assert.deepEqual(after.filter(t => t.workspaceId !== id), before.filter(t => t.workspaceId !== id));
    assert.equal((await patch()).status, 409); assert.deepEqual(await snapshot(), after);
    assert.equal((await patch({ versions: winner.versions })).status, 200);
  }
  return { races, foreignAndDuplicateDenied: true, partialOrderAndVersionsRollBack: true, concurrentReorderSingleWinner: true, staleReplayRejected: true, currentVersionRetryBothDirections: true, providerCalls: false, hosted: false };
}
