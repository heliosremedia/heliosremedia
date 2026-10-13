import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { requireDatabase } from './safety.mjs';
export async function qualifyWorkspaceLifecycle(driver) {
  const db = driver.prisma, races = [], cases = [];
  const client = new pg.Client({ connectionString: requireDatabase(process.env.PACKET19_DATABASE_URL) });
  await client.connect();
  try {
    assert.equal(await db.platformLifecycleOperator.count(), 0);
    assert.equal(await db.workspace.count({ where: { lifecycleState: 'ACTIVE', lifecycleRevision: 0 } }), 2);
    const beforeSchema = await driver.schemaFingerprint(), beforeIndexes = await driver.schemaIndexFingerprint();
    const people = await db.adminUser.findMany({ orderBy: { id: 'asc' } });
    const projects = await db.project.findMany({ orderBy: { id: 'asc' } });
    const constraints = async () => (await client.query(`SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='"PlatformLifecycleOperator"'::regclass ORDER BY conname`)).rows;
    const expectedConstraints = await constraints();
    // Only the fixed disposable database with pristine new state is admitted.
    await client.query('DROP TABLE "PlatformLifecycleOperator"; ALTER TABLE "Workspace" DROP COLUMN "lifecycleState", DROP COLUMN "lifecycleRevision", DROP COLUMN "lastReactivatedAt"; DROP TYPE "WorkspaceLifecycleState";');
    await client.query(await readFile(new URL('../../../prisma/migrations/20261008123000_workspace_lifecycle_foundation/migration.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../../../prisma/migrations/20261008211000_workspace_reactivation_cutoff/migration.sql', import.meta.url), 'utf8'));
    assert.equal(await driver.schemaFingerprint(), beforeSchema); assert.equal(await driver.schemaIndexFingerprint(), beforeIndexes);
    assert.deepEqual(await constraints(), expectedConstraints);
    assert.deepEqual(await db.adminUser.findMany({ orderBy: { id: 'asc' } }), people);
    for (const id of ['a', 'b']) {
      const other = id === 'a' ? 'b' : 'a';
      const actor = { userId: `u${other}`, workspaceId: other, sessionVersion: 1 };
      const transition = async (state, revision) => driver.transitionWorkspaceLifecycle(db, actor, { workspaceId: id, expectedRevision: revision ?? (await db.workspace.findUniqueOrThrow({ where: { id } })).lifecycleRevision, state, reason: 'Synthetic lifecycle qualification' });
      await assert.rejects(transition('SUSPENDED'), { name: 'Error' });
      await db.platformLifecycleOperator.create({ data: { userId: actor.userId } });
      await assert.rejects(transition('SUSPENDED'));
      await db.platformLifecycleOperator.update({ where: { userId: actor.userId }, data: { enabled: true } });
      await client.query(`CREATE FUNCTION synthetic_lifecycle_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='WORKSPACE_LIFECYCLE_CHANGED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_lifecycle_audit_failure BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION synthetic_lifecycle_audit_failure();`);
      const before = await db.workspace.findMany({ orderBy: { id: 'asc' } }), auditBefore = await db.auditEvent.count();
      try { await assert.rejects(transition('SUSPENDED')); assert.deepEqual(await db.workspace.findMany({ orderBy: { id: 'asc' } }), before); assert.equal(await db.auditEvent.count(), auditBefore); }
      finally { await client.query('DROP TRIGGER synthetic_lifecycle_audit_failure ON "AuditEvent"; DROP FUNCTION synthetic_lifecycle_audit_failure();'); }
      const revision = (await db.workspace.findUniqueOrThrow({ where: { id } })).lifecycleRevision;
      const concurrent = await Promise.allSettled([transition('SUSPENDED', revision), transition('SUSPENDED', revision)]);
      assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1); assert.equal(concurrent.filter(r => r.status === 'rejected').length, 1);
      assert.equal(await driver.workspaceIsActive(db, id), false); assert.equal(await driver.workspaceIsActive(db, other), true);
      await assert.rejects(transition('ACTIVE', revision)); await assert.rejects(transition('SUSPENDED'));
      await transition('ACTIVE'); assert.equal(await driver.workspaceIsActive(db, id), true);
      for (const change of ['operator-disabled', 'session-version', 'membership-revoked', 'account-inactive', 'operator-home-suspended']) {
        let pending;
        const current = await db.workspace.findUniqueOrThrow({ where: { id } });
        const beforeAudit = await db.auditEvent.count();
        try {
          await db.$transaction(async tx => {
            for (const lockId of [id, other].sort()) await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${lockId} FOR UPDATE`;
            const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending = transition('SUSPENDED', current.lifecycleRevision).then(value => ({ value }), error => ({ error }));
            let observed = false; const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
              const blocked = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;
              if (blocked.length) { observed = true; break; } await delay(25);
            }
            assert.equal(observed, true, change);
            if (change === 'operator-disabled') await tx.platformLifecycleOperator.update({ where: { userId: actor.userId }, data: { enabled: false } });
            if (change === 'session-version') await tx.adminUser.update({ where: { id: actor.userId }, data: { sessionVersion: 2 } });
            if (change === 'account-inactive') await tx.adminUser.update({ where: { id: actor.userId }, data: { active: false } });
            if (change === 'membership-revoked') await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: other, userId: actor.userId } }, data: { status: 'REVOKED' } });
            if (change === 'operator-home-suspended') await tx.workspace.update({ where: { id: other }, data: { lifecycleState: 'SUSPENDED' } });
          }, { timeout: 15000 });
          assert.ok((await pending).error); assert.deepEqual(await db.workspace.findUniqueOrThrow({ where: { id } }), current); assert.equal(await db.auditEvent.count(), beforeAudit);
          races.push({ tenant: id, change, databaseWaitObserved: true, transitionRejected: true, targetAndAuditUnchanged: true });
        } finally {
          await pending;
          await db.platformLifecycleOperator.update({ where: { userId: actor.userId }, data: { enabled: true } });
          await db.adminUser.update({ where: { id: actor.userId }, data: { active: true, sessionVersion: 1 } });
          await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: other, userId: actor.userId } }, data: { status: 'ACTIVE' } });
          await db.workspace.update({ where: { id: other }, data: { lifecycleState: 'ACTIVE' } });
        }
      }
      const audits = await db.auditEvent.findMany({ where: { workspaceId: id, action: 'WORKSPACE_LIFECYCLE_CHANGED' }, orderBy: { createdAt: 'asc' } });
      assert.equal(audits.length, 2); assert.equal(audits[0].actorId, actor.userId); assert.equal(audits[0].metadata.from, 'ACTIVE'); assert.equal(audits[1].metadata.to, 'ACTIVE');
      await db.platformLifecycleOperator.delete({ where: { userId: actor.userId } });
      cases.push({ tenant: id, tenantAndSupportRolesInsufficient: true, defaultDisabledEnrollment: true, staleAndRedundantDenied: true, concurrentSingleWinner: true, auditRollback: true, reversibleWithoutBusinessMutation: true });
    }
    assert.deepEqual(await db.project.findMany({ orderBy: { id: 'asc' } }), projects);
    assert.equal(await db.platformLifecycleOperator.count(), 0); assert.equal(await db.workspace.count({ where: { lifecycleState: 'ACTIVE' } }), 2);
    return { cases, races, checkedInMigrationApplied: true, schemaAndConstraintsMatched: true, syntheticOperatorsRemoved: true, allWorkspacesActive: true, businessRowsUnchanged: true, scope: 'internal-transition-core-only', requestAndWorkerEnforcementQualified: false };
  } finally { await client.end(); }
}
