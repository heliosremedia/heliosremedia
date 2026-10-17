import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';
import { requireDatabase } from './safety.mjs';

export async function qualifyWorkspaceLifecycleAdmission(origin, driver) {
  requireDatabase(process.env.PACKET19_DATABASE_URL);
  const db = driver.prisma, cases = [], races = [];
  assert.equal(await db.platformLifecycleOperator.count(), 0);
  assert.equal(await db.workspace.count({ where: { lifecycleState: 'ACTIVE' } }), 2);
  const people = await db.adminUser.findMany({ orderBy: { id: 'asc' } });
  const projects = await db.project.findMany({ orderBy: { id: 'asc' } });
  const request = (id, path, method = 'GET', body, headers = {}) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, path,
    { method, headers: { cookie: driver.cookie(id), ...headers }, ...(body === undefined ? {} : { body }) });
  const grantBody = id => ({ operatorId: `u${id}`, durationMinutes: 30, reason: 'Synthetic lifecycle admission', scope: 'DIAGNOSTICS' });
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const actor = { userId: `u${other}`, workspaceId: other, sessionVersion: 1 };
    const transition = async state => driver.transitionWorkspaceLifecycle(db, actor, { workspaceId: id,
      expectedRevision: (await db.workspace.findUniqueOrThrow({ where: { id } })).lifecycleRevision, state, reason: 'Synthetic admission qualification' });
    await db.platformLifecycleOperator.create({ data: { userId: actor.userId, enabled: true } });
    const created = await request(id, '/api/admin/support-grants', 'POST', grantBody(other));
    assert.equal(created.status, 201, created.text);
    const grant = JSON.parse(created.text).grant;
    const reverseCreated = await request(other, '/api/admin/support-grants', 'POST', grantBody(id));
    assert.equal(reverseCreated.status, 201, reverseCreated.text);
    const reverse = JSON.parse(reverseCreated.text).grant;
    const read = (who, grantId) => request(who, `/api/platform/support/diagnostics?grantId=${grantId}`);
    const before = await driver.snapshot(id);
    const patch = () => request(id, '/api/admin/homepage-projects', 'PATCH', { placementId: `hp${id}`, titleOverride: 'Must not persist while suspended' },
      { 'x-curation-revision': before.revision, 'x-curation-request': randomUUID() });
    const account = () => request(id, '/api/admin/users', 'PATCH', { userId: `u${id}`, displayName: 'Must not persist while suspended' });
    try {
      assert.equal((await read(other, grant.id)).status, 200);
      assert.equal((await read(id, reverse.id)).status, 200);
      await transition('SUSPENDED');
      assert.equal((await request(id, '/admin/homepage')).status, 307);
      assert.equal((await request(other, '/admin/homepage')).status, 200);
      assert.equal((await request(id, '/login')).status, 200);
      assert.equal((await patch()).status, 403);
      assert.equal((await account()).status, 403);
      assert.equal((await request(id, '/api/admin/support-grants', 'POST', grantBody(other))).status, 403);
      assert.equal((await request(id, '/api/admin/support-grants', 'DELETE', { grantId: grant.id })).status, 403);
      assert.equal((await read(other, grant.id)).status, 403, 'Suspended target denies active-home operator');
      assert.equal((await read(id, reverse.id)).status, 403, 'Suspended operator home denies active target');
      assert.deepEqual(await driver.snapshot(id), before);
      await transition('ACTIVE');
      assert.equal((await request(id, '/admin/homepage')).status, 200);
      assert.equal((await read(other, grant.id)).status, 200);
      assert.equal((await read(id, reverse.id)).status, 200);
      for (const [surface, send, status] of [
        ['content-write', patch, 403], ['account-edit', account, 409],
        ['support-target', () => read(other, grant.id), 403], ['support-operator-home', () => read(id, reverse.id), 403],
        ['support-grant', () => request(id, '/api/admin/support-grants', 'POST', grantBody(other)), 403],
        ['support-revoke', () => request(id, '/api/admin/support-grants', 'DELETE', { grantId: grant.id }), 403],
      ]) {
        let pending;
        const grantsBefore = await db.supportAccessGrant.findMany({ orderBy: { id: 'asc' } });
        const readsBefore = await db.auditEvent.count({ where: { action: 'SUPPORT_READ' } });
        try {
          await db.$transaction(async tx => {
            for (const lockId of [id, other].sort()) await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${lockId} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = send().then(value => ({ value }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              const blocked = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;
              if (blocked.length) { observed = true; break; } await delay(25);
            }
            assert.equal(observed, true, surface);
            // Synthetic blocker commits suspension while the real HTTP transaction waits.
            await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
          }, { timeout: 15000 });
          const result = await pending; assert.equal(result.error, undefined);
          assert.equal(result.value.status, status, `${surface}: ${result.value.text}`);
          assert.deepEqual(await driver.snapshot(id), before);
          assert.deepEqual(await db.adminUser.findMany({ orderBy: { id: 'asc' } }), people);
          assert.deepEqual(await db.supportAccessGrant.findMany({ orderBy: { id: 'asc' } }), grantsBefore);
          assert.equal(await db.auditEvent.count({ where: { action: 'SUPPORT_READ' } }), readsBefore);
          races.push({ tenant: id, surface, databaseWaitObserved: true, status, businessAndGrantRowsUnchanged: true, noSuccessfulSupportReadAudit: true });
        } finally {
          await pending;
          await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
        }
      }
      cases.push({ tenant: id, currentSessionDenied: true, otherTenantUnaffected: true, loginReachable: true,
        contentAndAccountDenied: true, supportTargetAndHomeDenied: true, grantsDenied: true, sameCookieReactivation: true });
    } finally {
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
      for (const [who, grantId] of [[id, grant.id], [other, reverse.id]]) assert.equal((await request(who, '/api/admin/support-grants', 'DELETE', { grantId })).status, 200);
      await db.platformLifecycleOperator.delete({ where: { userId: actor.userId } });
    }
  }
  assert.deepEqual(await db.adminUser.findMany({ orderBy: { id: 'asc' } }), people);
  assert.deepEqual(await db.project.findMany({ orderBy: { id: 'asc' } }), projects);
  assert.equal(await db.platformLifecycleOperator.count(), 0);
  assert.equal(await db.workspace.count({ where: { lifecycleState: 'ACTIVE' } }), 2);
  return { cases, races, syntheticOperatorsRemoved: true, allWorkspacesActive: true, businessRowsUnchanged: true,
    scope: 'current-session-common-write-account-edit-support-admission', publicAndWorkersQualified: false };
}
