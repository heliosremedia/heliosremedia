import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';
const fields = [
  ['brandLogo', 'brand-logo'], ['brandMonogram', 'brand-monogram'], ['favicon', 'favicon'], ['defaultSocialImage', 'social-image'],
  ['heliosStandardImage', 'homepage-images', 'helios-standard'], ['primaryConversionImage', 'homepage-images', 'primary-conversion'],
  ['heroVideo', 'hero-media', 'video'], ['heroPoster', 'hero-media', 'poster'],
];
export async function qualifySettingsAttachments(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async (tx = db) => ({ settings: await tx.siteSettings.findMany({ orderBy: { id: 'asc' } }), assets: await tx.workspaceAsset.findMany({ orderBy: { id: 'asc' } }) });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const request = (body, protocol = false, path = '/api/admin/site-settings', method = 'PATCH') => http(origin, `${other}.example.test`, path, { method, headers: { cookie: driver.cookie(id), 'x-workspace-id': other, ...(protocol ? { 'x-helios-settings-revision': '1' } : {}) }, body: { ...body, workspaceId: other } });
    const body = { businessName: `Synthetic ${id}`, phoneDisplay: '+15555555555', phoneE164: '+15555555555', bookingMode: 'PAUSED', locationLabel: 'Synthetic city', serviceArea: 'Synthetic area', defaultSeoTitle: 'Synthetic title', defaultSeoDescription: 'Synthetic description', standardPrinciples: [], approachCards: [], headerNavigation: [], footerNavigation: [], bookingHandoffEnabled: false, bookingRequestEnabled: false };
    const keys = {};
    for (const [field, path, kind] of fields) {
      const uploaded = await request({ kind, fileType: field === 'heroVideo' ? 'video/mp4' : 'image/png', fileSize: 100 }, false, `/api/admin/site-settings/${path}/presign`, 'POST');
      assert.equal(uploaded.status, 200, uploaded.text); const upload = JSON.parse(uploaded.text).upload;
      keys[field] = upload.key; body[field + 'Url'] = upload.publicUrl;
      if (!field.startsWith('hero')) body[field + 'StorageKey'] = upload.key;
    }
    const initial = await db.siteSettings.findUniqueOrThrow({ where: { workspaceId: id } });
    const assets = await db.workspaceAsset.findMany({ where: { providerKey: { in: Object.values(keys) } } });
    assert.equal(assets.length, 8);
    const beforeForeign = await snapshot();
    assert.equal((await request({ ...body, brandLogoStorageKey: `workspaces/${other}/site-brand/foreign.png` })).status, 400);
    assert.deepEqual(await snapshot(), beforeForeign);
    for (const change of ['revoked', 'editor', 'session-version', ...fields.map(([field]) => `asset-${field}`), 'asset-owner', 'record-owner', 'revision']) {
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
          else if (change === 'revision') await tx.siteSettings.update({ where: { id: initial.id }, data: { businessName: 'Concurrent settings', updatedAt: new Date(Date.now() + 1000) } });
          else if (change.startsWith('asset-')) {
            const key = keys[change === 'asset-owner' ? 'brandLogo' : change.slice(6)];
            await tx.workspaceAsset.update({ where: { id: assets.find(a => a.providerKey === key).id }, data: change === 'asset-owner' ? { workspaceId: other } : { status: 'QUARANTINED' } });
          } else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'EDITOR' } });
          afterChange = await snapshot(tx);
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = ['revoked', 'editor', 'session-version'].includes(change) ? 403 : change.startsWith('asset-') ? 400 : 409;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, settingsAndRegistryUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.workspaceAsset.updateMany({ where: { id: { in: assets.map(a => a.id) } }, data: { workspaceId: id, status: 'UPLOAD_PROVISIONED' } });
        await db.siteSettings.update({ where: { id: initial.id }, data: { workspaceId: id, businessName: initial.businessName } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet79_reject_settings() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic settings failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet79_reject_settings AFTER UPDATE ON "SiteSettings" FOR EACH ROW EXECUTE FUNCTION packet79_reject_settings()`);
      const before = await snapshot(); assert.equal((await request(body)).status, 500); assert.deepEqual(await snapshot(), before);
    } finally { await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS packet79_reject_settings ON "SiteSettings"'); await db.$executeRawUnsafe('DROP FUNCTION packet79_reject_settings()'); }
    const before = await snapshot(), row = await db.siteSettings.findUniqueOrThrow({ where: { workspaceId: id } });
    const versioned = { ...body, requestId: `settings-${id}`, editorRevision: { id: row.id, workspaceId: id, storedWorkspaceId: id, updatedAt: row.updatedAt.toISOString() } };
    const concurrent = await Promise.all([request(versioned, true), request(versioned, true)]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
    const saved = JSON.parse(concurrent.find(r => r.status === 200).text);
    assert.equal(saved.acknowledgement.revision.workspaceId, id); assert.equal(saved.acknowledgement.scope, 'full');
    for (const [field] of fields) assert.equal(saved.settings[field + 'Url'], body[field + 'Url']);
    assert.deepEqual((await snapshot()).assets, before.assets);
    assert.deepEqual((await snapshot()).settings.filter(s => s.workspaceId !== id), before.settings.filter(s => s.workspaceId !== id));
    const legacy = Object.fromEntries(fields.flatMap(([field]) => [[field + 'Url', `https://legacy.example.test/${field}.png`], ...(!field.startsWith('hero') ? [[field + 'StorageKey', `legacy-${field}.png`]] : [])]));
    await db.siteSettings.update({ where: { id: initial.id }, data: legacy });
    assert.equal((await request({ ...body, ...legacy })).status, 200);
    const cleared = Object.fromEntries(Object.keys(legacy).map(key => [key, null]));
    assert.equal((await request({ ...body, ...cleared })).status, 200);
  }
  return { races, allEightAttachmentsSaved: true, foreignAttachmentsDenied: true, rollback: true, concurrentSingleWinner: true, acknowledgementPreserved: true, registryAndForeignSettingsUnchanged: true, legacyAndClearPreserved: true, providerInspection: 'synthetic-no-network', hosted: false };
}
