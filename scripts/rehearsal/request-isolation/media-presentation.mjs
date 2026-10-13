import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyMediaPresentation(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async () => ({
    projects: await db.project.findMany({ orderBy: { id: 'asc' } }),
    media: await db.media.findMany({ orderBy: { id: 'asc' } }),
    heroes: await db.projectMediaCollectionHero.findMany({ orderBy: [{ projectId: 'asc' }, { serviceId: 'asc' }] }),
  });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a', serviceId = `packet67-${id}`;
    await db.service.create({ data: { id: serviceId, workspaceId: id, name: 'Synthetic photography', slug: 'photography' } });
    const ids = [0, 1, 2].map(n => `packet67-${id}-${n}`);
    await db.media.createMany({ data: ids.map((mediaId, n) => ({ id: mediaId, projectId: `p${id}`, serviceId, sourceType: 'UPLOADED_IMAGE', mediaCategory: 'PHOTOGRAPHY', storageKey: `projects/p${id}/packet67-${n}.jpg`, mimeType: 'image/jpeg', displayOrder: n })) });
    await db.project.update({ where: { id: `p${id}` }, data: { socialImageMediaId: ids[0] } });
    const patch = (action, mediaId = ids[2]) => http(origin, `${other}.example.test`, `/api/admin/projects/p${id}/media`, {
      method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other }, body: { action, mediaId, workspaceId: other },
    });
    const beforeDenial = await snapshot();
    const foreign = await db.media.findFirst({ where: { project: { workspaceId: other } } });
    assert.ok(foreign);
    assert.equal((await patch('set-hero', foreign.id)).status, 404);
    assert.equal((await patch('set-social-image', foreign.id)).status, 400);
    assert.deepEqual(await snapshot(), beforeDenial);
    for (const mode of ['hero', 'social-set', 'social-clear']) {
      const action = mode === 'hero' ? 'set-hero' : 'set-social-image';
      const mediaId = mode === 'social-clear' ? '' : ids[2];
      const changes = ['revoked', 'viewer', 'session-version', ...(mode === 'hero' ? ['media-key'] : mode === 'social-set' ? ['media-visibility'] : [])];
      for (const change of changes) {
        let pending, afterChange;
        const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = patch(action, mediaId).then(response => ({ response }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
              if (rows.length) { observed = true; break; } await delay(25);
            }
            assert.equal(observed, true, `${mode}/${change} must reach the fence`);
            if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
            else if (change === 'media-key') await tx.media.update({ where: { id: mediaId }, data: { storageKey: null } });
            else if (change === 'media-visibility') await tx.media.update({ where: { id: mediaId }, data: { visibility: 'HIDDEN' } });
            else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
            afterChange = { projects: await tx.project.findMany({ orderBy: { id: 'asc' } }), media: await tx.media.findMany({ orderBy: { id: 'asc' } }), heroes: await tx.projectMediaCollectionHero.findMany({ orderBy: [{ projectId: 'asc' }, { serviceId: 'asc' }] }) };
          }, { timeout: 15000 });
          const outcome = await pending; if (outcome.error) throw outcome.error;
          const expected = change === 'media-key' ? 404 : change === 'media-visibility' ? 400 : 403;
          assert.equal(outcome.response.status, expected); assert.deepEqual(await snapshot(), afterChange);
          races.push({ tenant: id, mode, change, databaseWaitObserved: true, status: expected, deniedRequestLeavesRowsUnchanged: true });
        } finally {
          await pending;
          await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
          await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
          await db.media.update({ where: { id: ids[2] }, data: { storageKey: `projects/p${id}/packet67-2.jpg`, visibility: 'VISIBLE' } });
        }
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet67_reject_project() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic presentation failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet67_reject_project BEFORE UPDATE ON "Project" FOR EACH ROW EXECUTE FUNCTION packet67_reject_project()`);
      for (const [action, mediaId] of [['set-hero', ids[2]], ['set-social-image', ids[2]], ['set-social-image', '']]) {
        const before = await snapshot();
        assert.equal((await patch(action, mediaId)).status, 500); assert.deepEqual(await snapshot(), before);
      }
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet67_reject_project ON "Project"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet67_reject_project()`);
    }
    const foreignBefore = (await snapshot());
    const responses = await Promise.all([patch('set-hero', ids[1]), patch('set-hero', ids[2])]);
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    const project = await db.project.findUnique({ where: { id: `p${id}` } });
    const hero = await db.projectMediaCollectionHero.findUnique({ where: { projectId_serviceId: { projectId: `p${id}`, serviceId } } });
    const media = await db.media.findMany({ where: { projectId: `p${id}`, serviceId }, orderBy: { displayOrder: 'asc' } });
    assert.equal(project.heroMediaId, hero.mediaId); assert.equal(media[0].id, hero.mediaId);
    assert.deepEqual(media.map(m => m.displayOrder), [0, 1, 2]);
    assert.ok([ids[1], ids[2]].includes(hero.mediaId));
    assert.equal((await patch('set-social-image', ids[2])).status, 200);
    assert.equal((await db.project.findUnique({ where: { id: `p${id}` } })).socialImageMediaId, ids[2]);
    assert.equal((await patch('set-social-image', '')).status, 200);
    assert.equal((await db.project.findUnique({ where: { id: `p${id}` } })).socialImageMediaId, null);
    const after = await snapshot();
    assert.deepEqual(after.projects.filter(p => p.workspaceId === other), foreignBefore.projects.filter(p => p.workspaceId === other));
    assert.deepEqual(after.media.filter(m => m.projectId === `p${other}`), foreignBefore.media.filter(m => m.projectId === `p${other}`));
    assert.deepEqual(after.heroes.filter(h => h.projectId === `p${other}`), foreignBefore.heroes.filter(h => h.projectId === `p${other}`));
  }
  return { races, foreignMediaDenied: true, projectFailureRollsBackHeroAndOrder: true, socialSetAndClearRollback: true, concurrentHeroCoherent: true, socialSetAndClearBothDirections: true, providerCalls: false, hosted: false };
}
