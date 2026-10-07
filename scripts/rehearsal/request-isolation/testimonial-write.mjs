import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyTestimonialWrite(origin, driver) {
  const db = driver.prisma, races = [];
  const snapshot = async (tx = db) => ({ testimonials: await tx.testimonial.findMany({ orderBy: { id: 'asc' } }), assets: await tx.workspaceAsset.findMany({ orderBy: { id: 'asc' } }) });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const request = (method, body, path = '/api/admin/testimonials') => http(origin, `${other}.example.test`, path, {
      method, headers: { cookie: driver.cookie(id), 'content-type': 'application/json', 'x-workspace-id': other }, body: JSON.stringify({ ...body, workspaceId: other }),
    });
    const keys = [];
    for (let n = 0; n < 2; n++) {
      const r = await request('POST', { fileName: 'synthetic.png', fileType: 'image/png', fileSize: 100 }, '/api/admin/testimonials/presign');
      assert.equal(r.status, 200); keys.push(JSON.parse(r.text).upload.key);
    }
    const body = key => ({ agentName: 'Synthetic testimonial', testimonial: 'Disposable content', photoStorageKey: key });
    const created = await request('POST', body(keys[0])); assert.equal(created.status, 201);
    const testimonialId = JSON.parse(created.text).testimonial.id;
    const original = await db.testimonial.findUniqueOrThrow({ where: { id: testimonialId } });
    const asset = await db.workspaceAsset.findFirstOrThrow({ where: { providerKey: keys[1] } });
    const write = (method, extra = {}) => request(method, { ...body(keys[1]), ...(method === 'PATCH' ? { action: 'update', testimonialId } : {}), ...extra });
    for (const method of ['POST', 'PATCH']) {
      const beforeForeign = await snapshot();
      assert.equal((await write(method, { photoStorageKey: `workspaces/${other}/testimonials/foreign.png` })).status, 400);
      if (method === 'PATCH') assert.equal((await write(method, { testimonialId: `packet69-${other}` })).status, 404);
      assert.deepEqual(await snapshot(), beforeForeign);
      const changes = ['revoked', 'viewer', 'session-version', 'asset-status', 'asset-owner', ...(method === 'PATCH' ? ['record-owner', 'image-changed'] : [])];
      for (const change of changes) {
        let pending, afterChange;
        const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } };
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = write(method).then(response => ({ response }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
              if (rows.length) { observed = true; break; } await delay(25);
            }
            assert.equal(observed, true, `${method} ${change} must reach transaction admission`);
            if (change === 'session-version') await tx.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 2 } });
            else if (change === 'record-owner') await tx.testimonial.update({ where: { id: testimonialId }, data: { workspaceId: other } });
            else if (change === 'image-changed') await tx.testimonial.update({ where: { id: testimonialId }, data: { photoStorageKey: null, photoUrl: null } });
            else if (change.startsWith('asset-')) await tx.workspaceAsset.update({ where: { id: asset.id }, data: change === 'asset-status' ? { status: 'QUARANTINED' } : { workspaceId: other } });
            else await tx.workspaceMembership.update({ where, data: change === 'revoked' ? { status: 'REVOKED' } : { role: 'VIEWER' } });
            afterChange = await snapshot(tx);
          }, { timeout: 15000 });
          const outcome = await pending; if (outcome.error) throw outcome.error;
          const expected = change === 'record-owner' ? 404 : change === 'image-changed' ? 409 : change.startsWith('asset-') ? 400 : 403;
          assert.equal(outcome.response.status, expected, `${method} ${change}`); assert.deepEqual(await snapshot(), afterChange);
          races.push({ tenant: id, method, change, databaseWaitObserved: true, status: expected, contentAndRegistryUnchanged: true });
        } finally {
          await pending;
          await db.workspaceMembership.update({ where, data: { status: 'ACTIVE', role: 'OWNER' } });
          await db.adminUser.update({ where: { id: `u${id}` }, data: { sessionVersion: 1 } });
          await db.workspaceAsset.update({ where: { id: asset.id }, data: { workspaceId: id, status: 'UPLOAD_PROVISIONED' } });
          await db.testimonial.update({ where: { id: testimonialId }, data: { workspaceId: id, photoStorageKey: original.photoStorageKey, photoUrl: original.photoUrl } });
        }
      }
      await db.$executeRawUnsafe(`CREATE FUNCTION packet72_reject_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic testimonial write failure'; END $$`);
      try {
        await db.$executeRawUnsafe(`CREATE TRIGGER packet72_reject_write AFTER ${method === 'POST' ? 'INSERT' : 'UPDATE'} ON "Testimonial" FOR EACH ROW EXECUTE FUNCTION packet72_reject_write()`);
        const before = await snapshot(); assert.equal((await write(method)).status, 500); assert.deepEqual(await snapshot(), before);
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS packet72_reject_write ON "Testimonial"`);
        await db.$executeRawUnsafe(`DROP FUNCTION packet72_reject_write()`);
      }
      const before = await snapshot(), response = await write(method); assert.equal(response.status, method === 'POST' ? 201 : 200);
      const result = JSON.parse(response.text); assert.equal(result.testimonial.photoStorageKey, keys[1]);
      if (method === 'PATCH') assert.equal(result.storageCleanupPending, true);
      const persisted = await db.testimonial.findUniqueOrThrow({ where: { id: result.testimonial.id } });
      assert.equal(persisted.workspaceId, id); assert.equal(persisted.photoStorageKey, keys[1]);
      const after = await snapshot(); assert.deepEqual(after.assets, before.assets);
      assert.deepEqual(after.testimonials.filter(t => t.workspaceId !== id), before.testimonials.filter(t => t.workspaceId !== id));
    }
    const legacy = { photoStorageKey: 'testimonials/retained-legacy.webp', photoUrl: 'https://legacy.example.test/retained.webp' };
    await db.testimonial.update({ where: { id: testimonialId }, data: legacy });
    assert.equal((await write('PATCH', legacy)).status, 200);
    assert.equal((await write('PATCH', { photoStorageKey: null, photoUrl: null })).status, 200);
    const cleared = await db.testimonial.findUniqueOrThrow({ where: { id: testimonialId } }); assert.equal(cleared.photoStorageKey, null); assert.equal(cleared.photoUrl, null);
  }
  return { races, foreignImageAndRecordDenied: true, failedWritesRollBack: true, ownedCreateAndReplacementBothDirections: true, registryAndUnrelatedContentRetained: true, unchangedLegacyAndClearSupported: true, providerInspection: 'synthetic-no-network', hosted: false };
}
