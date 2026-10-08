import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';
import { requireDatabase } from './safety.mjs';

export async function qualifyWorkspaceInvitations(origin, driver) {
  requireDatabase(process.env.PACKET19_DATABASE_URL);
  const db = driver.prisma, cases = [], races = [];
  const people = await db.adminUser.findMany({ orderBy: { id: 'asc' } });
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const request = (id, path, method, body, authenticated = true) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, path,
    { method, body, headers: authenticated ? { cookie: driver.cookie(id), 'x-workspace-id': id === 'a' ? 'b' : 'a' } : {} });
  for (const id of ['a', 'b']) {
    const email = `synthetic-lifecycle-invite-${id}@example.test`;
    assert.equal(await db.adminUser.count({ where: { email } }), 0);
    assert.equal(await db.adminInvitation.count({ where: { email } }), 0);
    const create = (role = 'EDITOR') => request(id, '/api/admin/users', 'POST', { email, displayName: 'Synthetic lifecycle invite', role });
    const first = await create(); assert.equal(first.status, 201, first.text);
    const token = new URL(JSON.parse(first.text).invitationUrl).searchParams.get('token'); assert.ok(token);
    const invitation = await db.adminInvitation.findFirstOrThrow({ where: { email, workspaceId: id, revokedAt: null } });
    const revoke = () => request(id, '/api/admin/users', 'DELETE', { invitationId: invitation.id });
    const accept = () => request(id, '/api/auth/accept-invite', 'POST', { token, password: 'Synthetic-only-password-831' }, false);
    const invitationRows = () => db.adminInvitation.findMany({ where: { email }, orderBy: { id: 'asc' } });
    try {
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
      assert.equal((await create()).status, 403); assert.equal((await revoke()).status, 403); assert.equal((await accept()).status, 409);
      assert.deepEqual(await invitationRows(), [invitation]);
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
      const scenarios = [
        ['create-suspend', create, 'suspend', 403], ['revoke-suspend', revoke, 'suspend', 403],
        ['create-demote', create, 'demote', 403], ['revoke-demote', revoke, 'demote', 403],
        ['owner-invite-owner-loss', () => create('OWNER'), 'owner-loss', 403],
        ['accept-suspend', accept, 'suspend', 409], ['accept-revoked', accept, 'revoke-token', 409],
      ];
      for (const [surface, send, change, status] of scenarios) {
        let pending;
        const before = await invitationRows();
        const auditBefore = await db.auditEvent.count({ where: { action: { in: ['USER_INVITED', 'USER_INVITATION_REVOKED', 'USER_INVITATION_ACCEPTED'] } } });
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = send().then(value => ({ value }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              const blocked = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;
              if (blocked.length) { observed = true; break; } await delay(25);
            }
            assert.equal(observed, true, surface);
            if (change === 'suspend') await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
            if (change === 'demote' || change === 'owner-loss') await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { role: change === 'owner-loss' ? 'ADMIN' : 'VIEWER' } });
            if (change === 'revoke-token') await tx.adminInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
          }, { timeout: 15000 });
          const result = await pending; assert.equal(result.error, undefined); assert.equal(result.value.status, status, `${surface}: ${result.value.text}`);
          assert.deepEqual(await db.adminUser.findMany({ orderBy: { id: 'asc' } }), people);
          assert.equal(await db.auditEvent.count({ where: { action: { in: ['USER_INVITED', 'USER_INVITATION_REVOKED', 'USER_INVITATION_ACCEPTED'] } } }), auditBefore);
          if (change === 'revoke-token') {
            const after = await invitationRows(); assert.ok(after[0].revokedAt); after[0].revokedAt = null; assert.deepEqual(after, before);
          } else assert.deepEqual(await invitationRows(), before);
          races.push({ tenant: id, surface, databaseWaitObserved: true, status, noIdentityOrInvitationMutation: true, noSuccessAudit: true });
        } finally {
          await pending;
          await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
          await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { role: 'OWNER', updatedAt: memberships.find(row => row.userId === `u${id}` && row.workspaceId === id).updatedAt } });
          await db.adminInvitation.update({ where: { id: invitation.id }, data: { revokedAt: null } });
        }
      }
      // Replacement is atomic: insertion failure must roll back old-token revocation.
      await db.$executeRawUnsafe(`CREATE FUNCTION synthetic_invitation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic invitation failure'; END $$`);
      await db.$executeRawUnsafe('CREATE TRIGGER synthetic_invitation_failure BEFORE INSERT ON "AdminInvitation" FOR EACH ROW EXECUTE FUNCTION synthetic_invitation_failure()');
      try { assert.equal((await create()).status, 500); assert.deepEqual(await invitationRows(), [invitation]); }
      finally { await db.$executeRawUnsafe('DROP TRIGGER synthetic_invitation_failure ON "AdminInvitation"'); await db.$executeRawUnsafe('DROP FUNCTION synthetic_invitation_failure()'); }
      assert.equal((await accept()).status, 200);
      const user = await db.adminUser.findUniqueOrThrow({ where: { email } }); assert.equal(user.workspaceId, id); assert.equal(user.role, 'EDITOR');
      const membership = await db.workspaceMembership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: id, userId: user.id } } });
      assert.equal(membership.status, 'ACTIVE'); assert.equal(membership.role, 'EDITOR');
      assert.equal((await accept()).status, 400, 'Accepted token cannot create a second account');
      cases.push({ tenant: id, suspendedCreateRevoke403: true, suspendedAccept409: true, replacementRollback: true, activeAccept200: true, ownedIdentityAndMembership: true, acceptedReplay400: true });
    } finally {
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
      await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { role: 'OWNER', updatedAt: memberships.find(row => row.userId === `u${id}` && row.workspaceId === id).updatedAt } });
      const synthetic = await db.adminUser.findUnique({ where: { email } });
      if (synthetic) {
        assert.equal(synthetic.workspaceId, id); assert.equal(synthetic.displayName, 'Synthetic lifecycle invite');
        await db.workspaceMembership.deleteMany({ where: { userId: synthetic.id } });
        await db.adminUser.delete({ where: { id: synthetic.id } });
      }
      await db.adminInvitation.deleteMany({ where: { email, workspaceId: id } });
    }
  }
  assert.deepEqual(await db.adminUser.findMany({ orderBy: { id: 'asc' } }), people);
  assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), memberships);
  return { cases, races, syntheticInvitationsAndIdentitiesRemoved: true, originalIdentityAndMembershipRowsRestored: true, scope: 'invitation-create-revoke-accept-only' };
}
