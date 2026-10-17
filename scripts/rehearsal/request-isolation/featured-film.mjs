import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';
export async function qualifyFeaturedFilm(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async (tx = db) => ({ settings: await tx.siteSettings.findMany({ orderBy: { id: 'asc' } }), assets: await tx.workspaceAsset.findMany({ orderBy: { id: 'asc' } }) });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const request = (body, protocol = false, path = '/api/admin/homepage-film', method = 'PATCH') => http(origin, `${other}.example.test`, path, { method, headers: { cookie: driver.cookie(id), 'x-workspace-id': other, ...(protocol ? { 'x-helios-film-revision': '1' } : {}) }, body: { ...body, workspaceId: other } });
    const body = { featuredFilmEnabled: true, featuredFilmDestination: '/portfolio?service=cinematic-films' };
    for (const kind of ['video', 'poster']) {
      const upload = await request({ kind, fileType: kind === 'video' ? 'video/mp4' : 'image/png', fileSize: 100 }, false, '/api/admin/homepage-film/presign', 'POST');
      assert.equal(upload.status, 200, upload.text); const data = JSON.parse(upload.text).upload;
      const field = kind === 'video' ? 'featuredFilmVideo' : 'featuredFilmPoster'; body[field + 'StorageKey'] = data.key; body[field + 'Url'] = data.publicUrl;
    }
    const initial = await db.siteSettings.findUniqueOrThrow({ where: { workspaceId: id } });
    const assets = await db.workspaceAsset.findMany({ where: { providerKey: { in: [body.featuredFilmVideoStorageKey, body.featuredFilmPosterStorageKey] } } });
    const beforeForeign = await snapshot();
    assert.equal((await request({ ...body, featuredFilmVideoStorageKey: `workspaces/${other}/site-featured-film/video-foreign.mp4` })).status, 400);
    assert.deepEqual(await snapshot(), beforeForeign);
    for (const change of ['revoked', 'viewer', 'session-version', 'video-status', 'poster-status', 'video-owner', 'poster-owner', 'record-owner', 'revision']) {
      let pending, afterChange;
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = request(body).then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true, change);
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else if (change === 'record-owner') await tx.siteSettings.update({ where: { id: initial.id }, data: { workspaceId: null } });
          else if (change === 'revision') await tx.siteSettings.update({ where: { id: initial.id }, data: { featuredFilmDestination: '/concurrent', updatedAt: new Date(Date.now() + 1000) } });
          else if (/^(video|poster)-/.test(change)) {
            const key = change.startsWith('video') ? body.featuredFilmVideoStorageKey : body.featuredFilmPosterStorageKey;
            await tx.workspaceAsset.update({ where: { id: assets.find(a => a.providerKey === key).id }, data: change.endsWith('owner') ? { workspaceId: other } : { status: 'QUARANTINED' } });
          } else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = await snapshot(tx);
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = ['revoked', 'viewer', 'session-version'].includes(change) ? 403 : /^(video|poster)-/.test(change) ? 400 : 409;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, settingsAndRegistryUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.workspaceAsset.updateMany({ where: { id: { in: assets.map(a => a.id) } }, data: { workspaceId: id, status: 'UPLOAD_PROVISIONED' } });
        await db.siteSettings.update({ where: { id: initial.id }, data: { workspaceId: id, featuredFilmDestination: initial.featuredFilmDestination } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet78_reject_film() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic film failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet78_reject_film AFTER UPDATE ON "SiteSettings" FOR EACH ROW EXECUTE FUNCTION packet78_reject_film()`);
      const before = await snapshot(); assert.equal((await request(body)).status, 500); assert.deepEqual(await snapshot(), before);
    } finally { await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS packet78_reject_film ON "SiteSettings"'); await db.$executeRawUnsafe('DROP FUNCTION packet78_reject_film()'); }
    const before = await snapshot();
    const row = await db.siteSettings.findUniqueOrThrow({ where: { workspaceId: id } });
    const versioned = { ...body, requestId: `film-${id}`, editorRevision: { id: row.id, workspaceId: id, storedWorkspaceId: id, updatedAt: row.updatedAt.toISOString() } };
    const concurrent = await Promise.all([request(versioned, true), request(versioned, true)]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
    const ack = JSON.parse(concurrent.find(r => r.status === 200).text).acknowledgement;
    assert.equal(ack.revision.workspaceId, id); assert.equal(ack.scope, 'featured-film');
    assert.deepEqual((await snapshot()).assets, before.assets);
    assert.deepEqual((await snapshot()).settings.filter(s => s.workspaceId !== id), before.settings.filter(s => s.workspaceId !== id));
    const legacy = { featuredFilmVideoStorageKey: `legacy-film-${id}.mp4`, featuredFilmVideoUrl: 'https://legacy.example.test/film.mp4', featuredFilmPosterStorageKey: `legacy-poster-${id}.png`, featuredFilmPosterUrl: 'https://legacy.example.test/poster.png' };
    await db.siteSettings.update({ where: { id: initial.id }, data: legacy });
    assert.equal((await request({ ...body, ...legacy })).status, 200);
    assert.equal((await request({ ...body, featuredFilmEnabled: false, featuredFilmVideoStorageKey: null, featuredFilmVideoUrl: null, featuredFilmPosterStorageKey: null, featuredFilmPosterUrl: null })).status, 200);
  }
  return { races, foreignAttachmentsDenied: true, rollback: true, concurrentSingleWinner: true, acknowledgementPreserved: true, registryAndForeignSettingsUnchanged: true, legacyAndClearPreserved: true, providerInspection: 'synthetic-no-network', hosted: false };
}
