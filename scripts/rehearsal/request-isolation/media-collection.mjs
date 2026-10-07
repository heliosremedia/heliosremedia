import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyMediaCollection(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async () => ({
    media: await db.media.findMany({ orderBy: { id: 'asc' } }),
    heroes: await db.projectMediaCollectionHero.findMany({ orderBy: [{ projectId: 'asc' }, { serviceId: 'asc' }] }),
    services: await db.projectService.findMany({ orderBy: [{ projectId: 'asc' }, { serviceId: 'asc' }] }),
  });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const source = `packet66-source-${id}`, destination = `packet66-destination-${id}`;
    await db.service.createMany({ data: [
      { id: source, workspaceId: id, name: 'Synthetic source', slug: 'packet66-source' },
      { id: destination, workspaceId: id, name: 'Synthetic drone destination', slug: 'drone-photography' },
    ] });
    const ids = [0, 1, 2].map(n => `packet66-${id}-${n}`);
    await db.media.createMany({ data: ids.map((mediaId, n) => ({ id: mediaId, projectId: `p${id}`, serviceId: source, sourceType: 'UPLOADED_IMAGE', mediaCategory: 'FLOOR_PLAN', storageKey: `projects/p${id}/synthetic-${n}.jpg`, displayOrder: n })) });
    await db.projectMediaCollectionHero.create({ data: { projectId: `p${id}`, serviceId: source, mediaCategory: 'FLOOR_PLAN', mediaId: ids[0] } });
    const patch = (action, changes = {}) => http(origin, `${other}.example.test`, `/api/admin/projects/p${id}/media`, {
      method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other },
      body: { action, mediaIds: [...ids].reverse(), mediaCategory: 'FLOOR_PLAN', serviceId: destination, workspaceId: other, ...changes },
    });
    const initial = await snapshot();
    const foreign = await db.media.findFirst({ where: { project: { workspaceId: other } } });
    assert.ok(foreign);
    assert.equal((await patch('reorder', { mediaIds: [foreign.id, ids[1], ids[2]] })).status, 409);
    assert.equal((await patch('bulk-update-category', { mediaIds: [foreign.id] })).status, 404);
    assert.equal((await patch('bulk-update-category', { serviceId: `s${other}` })).status, 409);
    assert.deepEqual(await snapshot(), initial);
    for (const action of ['reorder', 'bulk-update-category']) {
      const changes = ['revoked', 'viewer', 'session-version', ...(action === 'bulk-update-category' ? ['service-archived'] : [])];
      for (const change of changes) {
        const before = await snapshot(); let pending;
        const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = patch(action).then(response => ({ response }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
              if (rows.length) { observed = true; break; } await delay(25);
            }
            assert.equal(observed, true, `${action}/${change} must reach the database fence`);
            if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
            else if (change === 'service-archived') await tx.service.update({ where: { id: destination }, data: { archivedAt: new Date() } });
            else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          }, { timeout: 15000 });
          const outcome = await pending; if (outcome.error) throw outcome.error;
          const expected = change === 'service-archived' ? 409 : 403;
          assert.equal(outcome.response.status, expected); assert.deepEqual(await snapshot(), before);
          races.push({ tenant: id, action, change, databaseWaitObserved: true, status: expected, mediaHeroesAndLinksUnchanged: true });
        } finally {
          await pending;
          await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
          await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
          await db.service.update({ where: { id: destination }, data: { archivedAt: null } });
        }
      }
    }
    // Reorder writes earlier negative positions before the final selected row fails.
    // Bulk removes the hero before this trigger fails; neither may leave partial state.
    await db.$executeRawUnsafe(`CREATE FUNCTION packet66_reject_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id LIKE 'packet66-%-0' THEN RAISE EXCEPTION 'synthetic collection failure'; END IF; RETURN NEW; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet66_reject_update BEFORE UPDATE ON "Media" FOR EACH ROW EXECUTE FUNCTION packet66_reject_update()`);
      for (const action of ['reorder', 'bulk-update-category']) {
        const before = await snapshot();
        assert.equal((await patch(action)).status, 500); assert.deepEqual(await snapshot(), before, `${action} rollback`);
      }
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet66_reject_update ON "Media"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet66_reject_update()`);
    }
    const foreignBefore = await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } });
    const responses = await Promise.all([patch('reorder'), patch('reorder', { mediaIds: ids })]);
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    const ordered = await db.media.findMany({ where: { id: { in: ids } }, orderBy: { displayOrder: 'asc' } });
    assert.deepEqual(ordered.map(m => m.displayOrder), [0, 1, 2]);
    assert.ok([ids.join(','), [...ids].reverse().join(',')].includes(ordered.map(m => m.id).join(',')));
    const moved = await patch('bulk-update-category'); assert.equal(moved.status, 200);
    assert.equal(JSON.parse(moved.text).mediaCategory, 'DRONE_PHOTOGRAPHY');
    const rows = await db.media.findMany({ where: { id: { in: ids } }, orderBy: { displayOrder: 'asc' } });
    assert.deepEqual(rows.map(m => m.id), [...ids].reverse());
    assert.ok(rows.every(m => m.serviceId === destination && m.mediaCategory === 'DRONE_PHOTOGRAPHY'));
    assert.equal(await db.projectMediaCollectionHero.count({ where: { mediaId: { in: ids } } }), 0);
    assert.equal(await db.projectService.count({ where: { projectId: `p${id}`, serviceId: destination } }), 1);
    assert.deepEqual(await db.media.findMany({ where: { project: { workspaceId: other } }, orderBy: { id: 'asc' } }), foreignBefore);
  }
  return { races, foreignMediaAndServiceDenied: true, bothActionsRollback: true, concurrentReorderSerialized: true, bulkMoveBothDirections: true, providerCalls: false, hosted: false };
}
