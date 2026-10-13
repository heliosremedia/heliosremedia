import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyPhotoComparison(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async (tx = db) => ({ pages: await tx.photoComparisonPage.findMany({ orderBy: { id: 'asc' } }), pairs: await tx.photoComparisonPair.findMany({ orderBy: { id: 'asc' } }), assets: await tx.workspaceAsset.findMany({ orderBy: { id: 'asc' } }) });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const request = (method, body, path = '/api/admin/photo-comparison') => http(origin, `${other}.example.test`, path, { method, headers: { cookie: driver.cookie(id), 'x-workspace-id': other }, body: { ...body, workspaceId: other } });
    const keys = {};
    for (const kind of ['standard', 'editorial', 'detail']) {
      const response = await request('POST', { kind, fileType: 'image/png', fileSize: 100 }, '/api/admin/photo-comparison/presign');
      assert.equal(response.status, 200); keys[kind] = JSON.parse(response.text).upload.key;
    }
    const url = key => `http://127.0.0.1:1/assets/${key}`;
    const content = Object.fromEntries(['heroEyebrow', 'heroHeading', 'heroAccent', 'heroBody', 'comparisonEyebrow', 'comparisonHeading', 'comparisonBody', 'standardTitle', 'standardPositioning', 'standardDescription', 'editorialTitle', 'editorialPositioning', 'editorialDescription', 'editorialBadge', 'decisionEyebrow', 'decisionHeading', 'decisionBody', 'ctaEyebrow', 'ctaHeading', 'ctaBody', 'primaryLabel', 'secondaryLabel'].map(key => [key, `Synthetic ${id} ${key}`]));
    Object.assign(content, { standardFeatures: ['Synthetic standard'], editorialFeatures: ['Synthetic editorial'], primaryDestination: '/synthetic', secondaryDestination: '/synthetic' });
    const body = { updatedAt: '', active: true, content, detailImageStorageKey: keys.detail, detailImageUrl: url(keys.detail), detailImageAlt: 'Synthetic detail', pairs: [{ label: 'Synthetic pair', alt: 'Synthetic comparison', caption: 'Synthetic caption', standardImageStorageKey: keys.standard, standardImageUrl: url(keys.standard), editorialImageStorageKey: keys.editorial, editorialImageUrl: url(keys.editorial) }] };
    const initial = await Promise.all([request('PATCH', body), request('PATCH', body)]); assert.deepEqual(initial.map(r => r.status).sort(), [200, 409]);
    const original = await db.photoComparisonPage.findUniqueOrThrow({ where: { workspaceId: id }, include: { pairs: true } });
    body.updatedAt = original.updatedAt.toISOString(); body.pairs[0].id = original.pairs[0].id;
    const assets = await db.workspaceAsset.findMany({ where: { providerKey: { in: Object.values(keys) } } });
    const beforeForeign = await snapshot();
    assert.equal((await request('PATCH', { ...body, detailImageStorageKey: `workspaces/${other}/photo-comparison/detail.png` })).status, 400);
    assert.equal((await request('PATCH', { ...body, pairs: [{ ...body.pairs[0], editorialImageStorageKey: `workspaces/${other}/photo-comparison/editorial.png` }] })).status, 400);
    assert.equal((await request('PATCH', { ...body, updatedAt: 'stale' })).status, 409);
    assert.deepEqual(await snapshot(), beforeForeign);
    for (const change of ['revoked', 'viewer', 'session-version', 'asset-standard', 'asset-editorial', 'asset-detail', 'asset-owner', 'detail-changed', 'pair-changed', 'page-version']) {
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
          else if (change === 'detail-changed') await tx.photoComparisonPage.update({ where: { id: original.id }, data: { detailImageStorageKey: null, detailImageUrl: '/changed.webp', updatedAt: original.updatedAt } });
          else if (change === 'pair-changed') await tx.photoComparisonPair.update({ where: { id: original.pairs[0].id }, data: { standardImageStorageKey: null, standardImageUrl: '/changed.webp' } });
          else if (change === 'page-version') await tx.photoComparisonPage.update({ where: { id: original.id }, data: { updatedAt: new Date(original.updatedAt.getTime() + 1000) } });
          else if (change.startsWith('asset-')) {
            const selected = assets.find(a => a.providerKey === keys[change === 'asset-owner' ? 'detail' : change.slice(6)]);
            await tx.workspaceAsset.update({ where: { id: selected.id }, data: change === 'asset-owner' ? { workspaceId: other } : { status: 'QUARANTINED' } });
          } else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
          afterChange = await snapshot(tx);
        }, { timeout: 15000 });
        const outcome = await pending; if (outcome.error) throw outcome.error;
        const expected = ['revoked', 'viewer', 'session-version'].includes(change) ? 403 : change.startsWith('asset-') ? 400 : 409;
        assert.equal(outcome.response.status, expected, change); assert.deepEqual(await snapshot(), afterChange);
        races.push({ tenant: id, change, databaseWaitObserved: true, status: expected, pagePairsAndRegistryUnchanged: true });
      } finally {
        await pending;
        await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
        await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
        await db.workspaceAsset.updateMany({ where: { id: { in: assets.map(a => a.id) } }, data: { workspaceId: id, status: 'UPLOAD_PROVISIONED' } });
        await db.photoComparisonPage.update({ where: { id: original.id }, data: { detailImageStorageKey: original.detailImageStorageKey, detailImageUrl: original.detailImageUrl, updatedAt: original.updatedAt } });
        await db.photoComparisonPair.update({ where: { id: original.pairs[0].id }, data: { standardImageStorageKey: original.pairs[0].standardImageStorageKey, standardImageUrl: original.pairs[0].standardImageUrl } });
      }
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION packet74_reject_pair() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic pair insertion failure'; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER packet74_reject_pair AFTER INSERT ON "PhotoComparisonPair" FOR EACH ROW EXECUTE FUNCTION packet74_reject_pair()`);
      const before = await snapshot(); assert.equal((await request('PATCH', body)).status, 500); assert.deepEqual(await snapshot(), before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet74_reject_pair ON "PhotoComparisonPair"`);
      await db.$executeRawUnsafe(`DROP FUNCTION packet74_reject_pair()`);
    }
    const before = await snapshot();
    const results = await Promise.all([request('PATCH', body), request('PATCH', body)]); assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const saved = JSON.parse(results.find(r => r.status === 200).text).page;
    assert.equal(saved.workspaceId, id); assert.equal(saved.pairs.length, 1); assert.equal(saved.pairs[0].standardImageStorageKey, keys.standard);
    const after = await snapshot(); assert.deepEqual(after.assets, before.assets);
    assert.deepEqual(after.pages.filter(p => p.workspaceId !== id), before.pages.filter(p => p.workspaceId !== id));
    assert.deepEqual(after.pairs.filter(p => p.pageId !== original.id), before.pairs.filter(p => p.pageId !== original.id));
    assert.equal((await request('PATCH', body)).status, 409); assert.deepEqual(await snapshot(), after);
    const legacyKey = `site/photo-comparison/${id}/retained.webp`, legacyUrl = 'https://legacy.example.test/retained.webp';
    await db.photoComparisonPage.update({ where: { id: saved.id }, data: { detailImageStorageKey: legacyKey, detailImageUrl: legacyUrl } });
    await db.photoComparisonPair.update({ where: { id: saved.pairs[0].id }, data: { standardImageStorageKey: legacyKey, standardImageUrl: legacyUrl, editorialImageStorageKey: legacyKey, editorialImageUrl: legacyUrl } });
    const legacy = await db.photoComparisonPage.findUniqueOrThrow({ where: { id: saved.id }, include: { pairs: true } });
    assert.equal((await request('PATCH', { ...legacy, updatedAt: legacy.updatedAt.toISOString() })).status, 200);
  }
  return { races, foreignAndStaleDenied: true, initialAndExistingConcurrentSingleWinner: true, pageAndDeletedPairsRollBack: true, ownedReplacementAndLegacySupported: true, registryAndForeignContentRetained: true, staleRetryInert: true, providerInspection: 'synthetic-no-network', hosted: false };
}
