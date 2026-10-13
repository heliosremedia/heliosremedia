import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

const fields = [
  ['hero', 'heroImageStorageKey', 'heroImageUrl', 'heroImageAlt'],
  ['founder', 'founderImageStorageKey', 'founderImageUrl', 'founderImageAlt'],
  ['gallery-one', 'galleryOneStorageKey', 'galleryOneUrl', 'galleryOneAlt'],
  ['gallery-two', 'galleryTwoStorageKey', 'galleryTwoUrl', 'galleryTwoAlt'],
  ['gallery-three', 'galleryThreeStorageKey', 'galleryThreeUrl', 'galleryThreeAlt'],
];
export async function qualifyAboutPage(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async (tx = db) => ({ pages: await tx.aboutPageContent.findMany({ orderBy: { id: 'asc' } }), assets: await tx.workspaceAsset.findMany({ orderBy: { id: 'asc' } }) });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const request = (method, body, path = '/api/admin/about') => http(origin, `${other}.example.test`, path, { method, headers: { cookie: driver.cookie(id), 'x-workspace-id': other }, body: { ...body, workspaceId: other } });
    const body = Object.fromEntries(['heroEyebrow', 'heroHeadline', 'heroBody', 'storyEyebrow', 'storyIntro', 'storyHeadline', 'storyBodyLeft', 'storyBodyRight', 'founderEyebrow', 'founderFirstName', 'founderRole', 'founderBody', 'founderSignature', 'founderTitle', 'founderTeamNote', 'principlesEyebrow', 'principlesHeadline', 'principlesIntro', 'processEyebrow', 'processHeadline'].map(k => [k, `Synthetic ${id} ${k}`]));
    Object.assign(body, { founderEnabled: true, principles: [{ title: 'Synthetic principle', copy: 'Synthetic principle copy' }], process: [{ title: 'Synthetic process', copy: 'Synthetic process copy' }] });
    const prepare = async () => {
      const images = {};
      for (const [kind, keyField, urlField, altField] of fields) {
        const response = await request('POST', { kind, fileType: 'image/png', fileSize: 100 }, '/api/admin/about/presign'); assert.equal(response.status, 200);
        const upload = JSON.parse(response.text).upload; images[keyField] = upload.key; images[urlField] = upload.publicUrl; images[altField] = 'Synthetic image';
      }
      return images;
    };
    Object.assign(body, await prepare());
    const rejectWrite = async event => {
      await db.$executeRawUnsafe(`CREATE FUNCTION packet76_reject_about() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic About write failure'; END $$`);
      try {
        await db.$executeRawUnsafe(`CREATE TRIGGER packet76_reject_about AFTER ${event} ON "AboutPageContent" FOR EACH ROW EXECUTE FUNCTION packet76_reject_about()`);
        const before = await snapshot(); assert.equal((await request('PATCH', body)).status, 500); assert.deepEqual(await snapshot(), before);
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet76_reject_about ON "AboutPageContent"`);
        await db.$executeRawUnsafe(`DROP FUNCTION packet76_reject_about()`);
      }
    };
    await rejectWrite('INSERT');
    const created = await request('PATCH', body); assert.equal(created.status, 200); assert.equal(JSON.parse(created.text).content.workspaceId, id);
    const original = await db.aboutPageContent.findUniqueOrThrow({ where: { workspaceId: id } });
    Object.assign(body, await prepare());
    const assets = await db.workspaceAsset.findMany({ where: { providerKey: { in: fields.map(([, key]) => body[key]) } } });
    const beforeForeign = await snapshot();
    for (const [, key] of [fields[0], fields[4]]) assert.equal((await request('PATCH', { ...body, [key]: `workspaces/${other}/about/foreign.png` })).status, 400);
    assert.deepEqual(await snapshot(), beforeForeign);
    for (const change of ['revoked', 'viewer', 'session-version', ...fields.map(([kind]) => `asset-${kind}`), 'asset-owner', 'record-owner', 'image-changed']) {
      let pending, afterChange;
      const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = request('PATCH', body).then(response => ({ response }), error => ({ error }));
          let observed = false; const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
            if (rows.length) { observed = true; break; } await delay(25);
          }
          assert.equal(observed, true, change);
          if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
          else if (change === 'record-owner') await tx.aboutPageContent.update({ where: { id: original.id }, data: { workspaceId: null } });
          else if (change === 'image-changed') await tx.aboutPageContent.update({ where: { id: original.id }, data: { heroImageStorageKey: null, heroImageUrl: '/changed.webp' } });
          else if (change.startsWith('asset-')) {
            const [, key] = fields.find(([kind]) => kind === (change === 'asset-owner' ? 'hero' : change.slice(6)));
            const selected = assets.find(a => a.providerKey === body[key]);
            await tx.workspaceAsset.update({ where: { id: selected.id }, data: change === 'asset-owner' ? { workspaceId: other } : { status: 'QUARANTINED' } });
          } else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = await snapshot(tx);
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = ['revoked', 'viewer', 'session-version'].includes(change) ? 403 : change.startsWith('asset-') ? 400 : 409;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, contentAndRegistryUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.workspaceAsset.updateMany({ where: { id: { in: assets.map(a => a.id) } }, data: { workspaceId: id, status: 'UPLOAD_PROVISIONED' } });
        await db.aboutPageContent.update({ where: { id: original.id }, data: { workspaceId: id, heroImageStorageKey: original.heroImageStorageKey, heroImageUrl: original.heroImageUrl } });
      }
    }
    await rejectWrite('UPDATE');
    const before = await snapshot(), result = await request('PATCH', body); assert.equal(result.status, 200); assert.equal(JSON.parse(result.text).storageCleanupPending, true);
    const saved = await db.aboutPageContent.findUniqueOrThrow({ where: { workspaceId: id } });
    for (const [, key] of fields) assert.equal(saved[key], body[key]);
    const after = await snapshot(); assert.deepEqual(after.assets, before.assets); assert.deepEqual(after.pages.filter(p => p.workspaceId !== id), before.pages.filter(p => p.workspaceId !== id));
    const concurrent = await Promise.all(['first', 'second'].map(value => request('PATCH', { ...body, heroBody: value, storyBodyLeft: value })));
    assert.deepEqual(concurrent.map(r => r.status), [200, 200]);
    const complete = await db.aboutPageContent.findUniqueOrThrow({ where: { workspaceId: id } }); assert.equal(complete.heroBody, complete.storyBodyLeft); assert.ok(['first', 'second'].includes(complete.heroBody));
    const legacyImages = Object.fromEntries(fields.flatMap(([, key, url]) => [[key, `about/retained-${id}.webp`], [url, 'https://legacy.example.test/retained.webp']]));
    await db.aboutPageContent.update({ where: { id: original.id }, data: legacyImages });
    assert.equal((await request('PATCH', { ...body, ...legacyImages })).status, 200);
    const clear = Object.fromEntries(fields.flatMap(([, key, url]) => [[key, null], [url, null]]));
    const cleared = await request('PATCH', { ...body, ...clear }); assert.equal(cleared.status, 200); assert.equal(JSON.parse(cleared.text).storageCleanupPending, true);
    const final = await db.aboutPageContent.findUniqueOrThrow({ where: { workspaceId: id } }); for (const [, key, url] of fields) { assert.equal(final[key], null); assert.equal(final[url], null); }
  }
  return { races, foreignImagesDenied: true, createAndUpdateRollback: true, fiveImageReplacementAndRetention: true, completeConcurrentCopy: true, unchangedLegacyAndClearSupported: true, providerInspection: 'synthetic-no-network', hosted: false };
}
