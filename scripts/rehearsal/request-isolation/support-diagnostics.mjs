import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { requireDatabase } from './safety.mjs';
import { http } from './http.mjs';

export async function qualifySupportDiagnostics(origin, driver) {
  const db = driver.prisma, cases = [], races = [];
  assert.equal(await db.platformSupportOperator.count(), 0);
  assert.equal(await db.supportAccessGrant.count(), 0);
  const client = new pg.Client({ connectionString: requireDatabase(process.env.PACKET19_DATABASE_URL) });
  await client.connect();
  try {
    const columns = await driver.schemaFingerprint(), indexes = await driver.schemaIndexFingerprint();
    const constraints = async () => (await client.query(`SELECT conname, pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid IN ('"SupportAccessGrant"'::regclass,'"PlatformSupportOperator"'::regclass) ORDER BY conname`)).rows;
    const beforeConstraints = await constraints();
    // Safety admits only the fixed disposable database and empty new tables.
    await client.query('DROP TABLE "SupportAccessGrant"; DROP TABLE "PlatformSupportOperator"; DROP TYPE "SupportAccessScope";');
    await client.query(await readFile(new URL('../../../prisma/migrations/20261007140000_support_access_foundation/migration.sql', import.meta.url), 'utf8'));
    assert.equal(await driver.schemaFingerprint(), columns);
    assert.equal(await driver.schemaIndexFingerprint(), indexes);
    assert.deepEqual(await constraints(), beforeConstraints);
    const request = (actor, path, method = 'GET', body) => http(origin, `${actor === 'a' ? 'b' : 'a'}.example.test`, path, { method, headers: { cookie: driver.cookie(actor), 'x-workspace-id': actor === 'a' ? 'b' : 'a' }, ...(body === undefined ? {} : { body }) });
    const grantBody = other => ({ operatorId: `u${other}`, durationMinutes: 30, reason: 'Synthetic qualification only', scope: 'DIAGNOSTICS', workspaceId: other });
    const create = (id, other) => request(id, '/api/admin/support-grants', 'POST', grantBody(other));
    const read = (id, grant) => request(id, `/api/platform/support/diagnostics?grantId=${grant}&workspaceId=${id}`);
    for (const id of ['a', 'b']) assert.equal((await create(id, id === 'a' ? 'b' : 'a')).status, 403, 'Tenant OWNER alone has no platform authority');
    for (const id of ['a', 'b']) {
      const row = await db.platformSupportOperator.create({ data: { userId: `u${id}` } });
      assert.equal(row.enabled, false);
    }
    assert.equal((await create('a', 'b')).status, 403);
    await db.platformSupportOperator.updateMany({ data: { enabled: true } });
    const businessBefore = await db.project.findMany({ orderBy: { id: 'asc' } });
    for (const id of ['a', 'b']) {
      const other = id === 'a' ? 'b' : 'a';
      assert.equal((await create(id, id)).status, 403);
      for (const patch of [{ scope: 'WRITE' }, { durationMinutes: 31 }, { durationMinutes: 0 }, { durationMinutes: 1.5 }, { reason: '' }]) {
        assert.equal((await request(id, '/api/admin/support-grants', 'POST', { ...grantBody(other), ...patch })).status, 400);
      }
      for (const role of ['ADMIN', 'EDITOR', 'VIEWER']) {
        await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { role } });
        try { assert.equal((await create(id, other)).status, 403); }
        finally { await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { role: 'OWNER' } }); }
      }
      const created = await create(id, other); assert.equal(created.status, 201, created.text);
      const grant = JSON.parse(created.text).grant; assert.equal(grant.workspaceId, id);
      assert.equal('reason' in grant, false);
      const accepted = await read(other, grant.id); assert.equal(accepted.status, 200, accepted.text);
      assert.equal(accepted.headers['cache-control'], 'private, no-store');
      assert.deepEqual(JSON.parse(accepted.text), { success: true, diagnostics: { workspaceId: id, scope: 'DIAGNOSTICS', countLimit: 10000, counts: { projects: await db.project.count({ where: { workspaceId: id } }), activeMemberships: 1 } } });
      assert.equal((await read(id, grant.id)).status, 403);
      assert.equal((await read(other, 'unknown-grant')).status, 403);
      assert.equal((await request(other, `/api/platform/support/diagnostics?grantId=${grant.id}`, 'POST', {})).status, 405);
      assert.equal((await request(other, '/api/admin/support-grants', 'DELETE', { grantId: grant.id })).status, 403);
      const changes = [
        ['operator-disabled', tx => tx.platformSupportOperator.update({ where: { userId: `u${other}` }, data: { enabled: false } }), () => db.platformSupportOperator.update({ where: { userId: `u${other}` }, data: { enabled: true } })],
        ['operator-inactive', tx => tx.adminUser.update({ where: { id: `u${other}` }, data: { active: false } }), () => db.adminUser.update({ where: { id: `u${other}` }, data: { active: true } })],
        ['operator-session', tx => tx.adminUser.update({ where: { id: `u${other}` }, data: { sessionVersion: 2 } }), () => db.adminUser.update({ where: { id: `u${other}` }, data: { sessionVersion: 1 } })],
        ['operator-membership', tx => tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: other, userId: `u${other}` } }, data: { status: 'REVOKED' } }), () => db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: other, userId: `u${other}` } }, data: { status: 'ACTIVE' } })],
        ['issuer-demoted', tx => tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { role: 'ADMIN' } }), () => db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { role: 'OWNER' } })],
        ['issuer-inactive', tx => tx.adminUser.update({ where: { id: `u${id}` }, data: { active: false } }), () => db.adminUser.update({ where: { id: `u${id}` }, data: { active: true } })],
        ['grant-revoked', tx => tx.supportAccessGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } }), () => db.supportAccessGrant.update({ where: { id: grant.id }, data: { revokedAt: null } })],
        ['grant-expired', tx => tx.supportAccessGrant.update({ where: { id: grant.id }, data: { expiresAt: new Date(0) } }), () => db.supportAccessGrant.update({ where: { id: grant.id }, data: { expiresAt: new Date(grant.expiresAt) } })],
      ];
      for (const [name, change, restore] of changes) {
        let pending;
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = read(other, grant.id).then(response => ({ response }), error => ({ error }));
            const deadline = Date.now() + 8000; let blocked = false;
            while (Date.now() < deadline) {
              const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;
              if (rows.length) { blocked = true; break; } await delay(25);
            }
            assert.equal(blocked, true, name); await change(tx);
          }, { timeout: 15000 });
          const outcome = await pending; if (outcome.error) throw outcome.error;
          assert.equal(outcome.response.status, 403, name);
          assert.equal(outcome.response.text.includes('counts'), false);
          races.push({ tenant: id, change: name, databaseWaitObserved: true, status: 403 });
        } finally { await pending; await restore(); }
      }
      for (const action of ['GRANTED', 'READ', 'REVOKED']) {
        await client.query(`CREATE FUNCTION synthetic_support_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SUPPORT_${action}' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_support_audit_failure BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION synthetic_support_audit_failure();`);
        const before = await db.supportAccessGrant.findMany({ orderBy: { id: 'asc' } });
        try {
          const response = action === 'GRANTED' ? await create(id, other) : action === 'READ' ? await read(other, grant.id) : await request(id, '/api/admin/support-grants', 'DELETE', { grantId: grant.id });
          assert.equal(response.status, 503, response.text); assert.equal(response.text.includes('synthetic audit failure'), false);
          assert.deepEqual(await db.supportAccessGrant.findMany({ orderBy: { id: 'asc' } }), before);
        } finally { await client.query('DROP TRIGGER synthetic_support_audit_failure ON "AuditEvent"; DROP FUNCTION synthetic_support_audit_failure();'); }
      }
      assert.equal((await request(id, '/api/admin/support-grants', 'DELETE', { grantId: grant.id })).status, 200);
      assert.equal((await read(other, grant.id)).status, 403);
      for (const action of ['GRANTED', 'READ', 'REVOKED']) assert.ok(await db.auditEvent.count({ where: { entityId: grant.id, action: `SUPPORT_${action}`, workspaceId: id } }));
      cases.push({ tenant: id, explicitConsent: true, ownerOnly: true, separateOperator: true, fixedDiagnosticProjection: true, spoofedTargetIgnored: true, auditFailureRollback: true, revocation: true });
    }
    const paired = await Promise.all([create('a', 'b'), create('b', 'a')]);
    for (const response of paired) assert.equal(response.status, 201, response.text);
    const grants = paired.map(response => JSON.parse(response.text).grant);
    const concurrent = await Promise.all([read('b', grants[0].id), read('a', grants[1].id)]);
    for (const response of concurrent) assert.equal(response.status, 200, response.text);
    await Promise.all(grants.map((grant, i) => request(i === 0 ? 'a' : 'b', '/api/admin/support-grants', 'DELETE', { grantId: grant.id })));
    assert.deepEqual(await db.project.findMany({ orderBy: { id: 'asc' } }), businessBefore);
    assert.equal((await http(origin, 'a.example.test', '/api/platform/support/diagnostics?grantId=unknown')).status, 403);
    return { cases, races, checkedInMigrationApplied: true, declaredSchemaMatched: true, emptyDisabledRegistry: true, businessRowsUnchanged: true, syntheticOperatorsOnly: true, reciprocalConcurrentAccess: true, realOperatorEnrollment: false };
  } finally { await client.end(); }
}
