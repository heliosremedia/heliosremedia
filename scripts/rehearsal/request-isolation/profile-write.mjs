import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';
import { requireDatabase } from './safety.mjs';

export async function qualifyProfileWrite(origin, driver) {
  requireDatabase(process.env.PACKET19_DATABASE_URL);
  const db = driver.prisma, cases = [], races = [];
  const originalUsers = await db.adminUser.findMany({ orderBy: { id: 'asc' } });
  const originalMemberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const password = 'Synthetic-only-profile-841', replacement = 'Synthetic-only-profile-842';
  const seededHash = await driver.hashPassword(password);
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const original = originalUsers.find(user => user.id === `u${id}`);
    const member = originalMemberships.find(row => row.workspaceId === id && row.userId === original.id);
    const restore = async () => {
      await db.$executeRaw`UPDATE "AdminUser" SET "workspaceId"=${original.workspaceId},active=${original.active},"sessionVersion"=${original.sessionVersion},email=${original.email},"passwordHash"=${original.passwordHash},"firstName"=${original.firstName},"lastName"=${original.lastName},"displayName"=${original.displayName},title=${original.title},phone=${original.phone},"notificationPreferences"=${original.notificationPreferences === null ? null : JSON.stringify(original.notificationPreferences)}::jsonb,"failedLoginCount"=${original.failedLoginCount},"lockedUntil"=${original.lockedUntil},"updatedAt"=${original.updatedAt} WHERE id=${original.id}`;
      await db.workspaceMembership.update({ where: { id: member.id }, data: { role: member.role, status: member.status, updatedAt: member.updatedAt } });
      await db.workspace.update({ where: { id }, data: { lifecycleState: 'ACTIVE' } });
    };
    const seed = () => db.adminUser.update({ where: { id: original.id }, data: { passwordHash: seededHash } });
    const body = { firstName: original.firstName, lastName: original.lastName, displayName: 'Synthetic profile changed', title: original.title, email: original.email, phone: original.phone, notificationPreferences: original.notificationPreferences ?? {} };
    const send = (patch = {}) => http(origin, `${other}.example.test`, '/api/admin/profile', { method: 'PATCH', headers: { cookie: driver.cookie(id), 'x-workspace-id': other }, body: { ...body, ...patch } });
    const snapshot = () => db.adminUser.findMany({ orderBy: { id: 'asc' } });
    try {
      await seed();
      for (const change of ['suspend', 'membership-revoked', 'viewer', 'session-version', 'account-inactive', 'workspace-transfer', 'credential-drift']) {
        let pending, afterChange;
        const beforeAudit = await db.auditEvent.count({ where: { action: { in: ['PROFILE_EMAIL_CHANGED', 'PROFILE_PASSWORD_CHANGED'] } } });
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = send({ currentPassword: password, newPassword: replacement }).then(value => ({ value }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              const blocked = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;
              if (blocked.length) { observed = true; break; } await delay(25);
            }
            assert.equal(observed, true, change);
            if (change === 'suspend') await tx.workspace.update({ where: { id }, data: { lifecycleState: 'SUSPENDED' } });
            if (change === 'membership-revoked') await tx.workspaceMembership.update({ where: { id: member.id }, data: { status: 'REVOKED' } });
            if (change === 'viewer') await tx.workspaceMembership.update({ where: { id: member.id }, data: { role: 'VIEWER' } });
            if (change === 'session-version') await tx.adminUser.update({ where: { id: original.id }, data: { sessionVersion: 2 } });
            if (change === 'account-inactive') await tx.adminUser.update({ where: { id: original.id }, data: { active: false } });
            if (change === 'workspace-transfer') await tx.adminUser.update({ where: { id: original.id }, data: { workspaceId: other } });
            if (change === 'credential-drift') await tx.adminUser.update({ where: { id: original.id }, data: { passwordHash: 'synthetic-changed-credential' } });
            afterChange = await tx.adminUser.findMany({ orderBy: { id: 'asc' } });
          }, { timeout: 15000 });
          const result = await pending; assert.equal(result.error, undefined); assert.equal(result.value.status, 403, result.value.text);
          assert.deepEqual(await snapshot(), afterChange); assert.equal(await db.auditEvent.count({ where: { action: { in: ['PROFILE_EMAIL_CHANGED', 'PROFILE_PASSWORD_CHANGED'] } } }), beforeAudit);
          races.push({ tenant: id, change, databaseWaitObserved: true, status: 403, profileAndCredentialsUnchanged: true, noSuccessAudit: true });
        } finally { await pending; await restore(); await seed(); }
      }
      const beforeFailure = await snapshot(), beforeAudit = await db.auditEvent.count();
      await db.$executeRawUnsafe(`CREATE FUNCTION synthetic_profile_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('PROFILE_EMAIL_CHANGED','PROFILE_PASSWORD_CHANGED') THEN RAISE EXCEPTION 'synthetic profile audit failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe('CREATE TRIGGER synthetic_profile_audit_failure BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION synthetic_profile_audit_failure()');
      try { assert.equal((await send({ currentPassword: password, newPassword: replacement })).status, 500); assert.deepEqual(await snapshot(), beforeFailure); assert.equal(await db.auditEvent.count(), beforeAudit); }
      finally { await db.$executeRawUnsafe('DROP TRIGGER synthetic_profile_audit_failure ON "AuditEvent"'); await db.$executeRawUnsafe('DROP FUNCTION synthetic_profile_audit_failure()'); }
      assert.equal((await send()).status, 200);
      const saved = await db.adminUser.findUniqueOrThrow({ where: { id: original.id } }); assert.equal(saved.displayName, body.displayName); assert.equal(saved.sessionVersion, 1);
      const changed = await send({ currentPassword: password, newPassword: replacement }); assert.equal(changed.status, 200); assert.equal(JSON.parse(changed.text).signedOut, true);
      const secured = await db.adminUser.findUniqueOrThrow({ where: { id: original.id } }); assert.equal(secured.sessionVersion, 2); assert.equal(await driver.verifyPassword(replacement, secured.passwordHash), true);
      const audit = await db.auditEvent.findFirstOrThrow({ where: { action: 'PROFILE_PASSWORD_CHANGED', actorId: original.id }, orderBy: { createdAt: 'desc' } }); assert.equal(audit.workspaceId, id);
      assert.equal((await send()).status, 401, 'Old session is revoked');
      assert.deepEqual((await snapshot()).find(row => row.id === `u${other}`), originalUsers.find(row => row.id === `u${other}`));
      cases.push({ tenant: id, auditFailureRollsBack: true, ordinaryEdit200: true, credentialEdit200: true, ownedAudit: true, oldSession401: true, otherAccountUnchanged: true });
    } finally { await restore(); }
  }
  assert.deepEqual(await snapshotAll(db), originalUsers);
  assert.deepEqual(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } }), originalMemberships);
  return { cases, races, originalIdentityAndMembershipRowsRestored: true, syntheticCredentialsRestored: true, scope: 'self-profile-write-only' };
}
const snapshotAll = db => db.adminUser.findMany({ orderBy: { id: 'asc' } });
