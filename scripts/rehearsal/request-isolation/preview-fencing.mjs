import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyPreviewFencing(origin, driver) {
  const results = [];
  for (const id of ['a', 'b']) {
    const headers = { cookie: driver.cookie(id) };
    const endpoint = `/api/admin/projects/p${id}/previews`;
    for (const method of ['POST', 'DELETE']) {
      let previewId;
      if (method === 'DELETE') {
        const created = await http(origin, `${id}.example.test`, endpoint, { method: 'POST', headers, body: { days: 1 } });
        assert.equal(created.status, 201); previewId = JSON.parse(created.text).preview.id;
      }
      const before = await driver.prisma.projectPreviewLink.findMany({ orderBy: { id: 'asc' } });
      const auditBefore = await driver.prisma.auditEvent.count();
      let pending;
      try {
        await driver.prisma.$transaction(async tx => {
          // Hold both new authorization and historical mutation lock targets.
          // The HTTP request resolves its initial session, then demonstrably waits
          // in PostgreSQL before membership changes. No timing-only race claim.
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${`p${id}`} FOR UPDATE`;
          if (previewId) await tx.$queryRaw`SELECT id FROM "ProjectPreviewLink" WHERE id=${previewId} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = http(origin, `${id}.example.test`, endpoint + (previewId ? `?previewId=${previewId}` : ''), {
            method, headers, ...(method === 'POST' ? { body: { days: 1 } } : {}),
          }).then(response => ({ response }), error => ({ error }));
          const deadline = Date.now() + 8000; let blocked = false;
          while (Date.now() < deadline) {
            const rows = await driver.prisma.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid} = ANY(pg_blocking_pids(pid))`;
            if (rows.length) { blocked = true; break; }
            await delay(25);
          }
          assert.equal(blocked, true, 'Actual HTTP mutation must be observed waiting on the held database lock');
          await tx.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { status: 'REVOKED' } });
        }, { timeout: 15000 });
        const outcome = await pending;
        if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, 403, 'Current membership must be rechecked after acquiring the write lock');
        assert.deepEqual(await driver.prisma.projectPreviewLink.findMany({ orderBy: { id: 'asc' } }), before);
        assert.equal(await driver.prisma.auditEvent.count(), auditBefore);
        results.push({ tenant: id, method, databaseWaitObserved: true, revokedAfterInitialSession: true, status: 403, previewRowsUnchanged: true, auditRowsUnchanged: true });
      } finally {
        // Drain the request before restoring access, including a failed assertion.
        await pending;
        await driver.prisma.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }, data: { status: 'ACTIVE' } });
      }
    }
  }
  return results;
}
