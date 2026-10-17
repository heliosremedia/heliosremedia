import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyTestimonialStatus(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = () => db.testimonial.findMany({ orderBy: { id: 'asc' } });
  for (const id of ['a', 'b']) await db.testimonial.create({ data: { id: `packet69-${id}`, workspaceId: id, agentName: `Synthetic ${id}`, testimonial: `Company ${id} only`, published: false, featured: false } });
  await db.testimonial.create({ data: { id: 'packet69-unowned', workspaceId: null, agentName: 'Unowned', testimonial: 'Legacy synthetic' } });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a', testimonialId = `packet69-${id}`;
    const patch = (changes = {}) => http(origin, `${other}.example.test`, '/api/admin/testimonials', {
      method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other },
      body: { action: 'set-status', testimonialId, published: true, featured: true, workspaceId: other, ...changes },
    });
    const initial = await snapshot();
    for (const denied of [`packet69-${other}`, 'packet69-unowned', 'missing']) assert.equal((await patch({ testimonialId: denied })).status, 404);
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
          else if (change === 'record-owner') await tx.testimonial.update({ where: { id: testimonialId }, data: { workspaceId: other } });
          else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = await tx.testimonial.findMany({ orderBy: { id: 'asc' } });
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = change === 'record-owner' ? 404 : 403;
        assert.equal(outcome.response.status, expected); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, deniedRequestLeavesRowsUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.testimonial.update({ where: { id: testimonialId }, data: { workspaceId: id } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet69_reject_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic status failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet69_reject_status AFTER UPDATE ON "Testimonial" FOR EACH ROW EXECUTE FUNCTION packet69_reject_status()`);
      const before = await snapshot(); assert.equal((await patch()).status, 500); assert.deepEqual(await snapshot(), before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet69_reject_status ON "Testimonial"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet69_reject_status()`);
    }
    const before = await snapshot();
    const success = await patch(); assert.equal(success.status, 200);
    const saved = await db.testimonial.findUnique({ where: { id: testimonialId } });
    assert.equal(saved.published, true); assert.equal(saved.featured, true);
    assert.equal(JSON.parse(success.text).testimonial.id, testimonialId);
    assert.equal(saved.agentName, `Synthetic ${id}`); assert.equal(saved.testimonial, `Company ${id} only`);
    assert.equal((await patch({ published: false, featured: false })).status, 200);
    const cleared = await db.testimonial.findUnique({ where: { id: testimonialId } });
    assert.equal(cleared.published, false); assert.equal(cleared.featured, false);
    assert.deepEqual((await snapshot()).filter(t => t.id !== testimonialId), before.filter(t => t.id !== testimonialId));
  }
  return { races, foreignAndUnownedDenied: true, failedStatusRollsBack: true, ownedPublishAndUnpublishBothDirections: true, unrelatedContentPreserved: true, providerCalls: false, hosted: false };
}
