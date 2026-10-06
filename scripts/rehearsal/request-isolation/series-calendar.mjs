import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifySeriesCalendar(origin, driver) {
  const db = driver.prisma, cases = [], series = {};
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const response = await http(origin, `${other}.example.test`, '/api/admin/social/series', {
      method: 'POST', headers: { cookie: driver.cookie(id) }, body: { workspaceId: other, name: `Calendar ${id}`, platforms: ['FACEBOOK'], startsAt: '2026-10-26', frequency: 'WEEKLY', localTime: '09:00', timeZone: id === 'a' ? 'America/Denver' : 'Australia/Brisbane' },
    });
    assert.equal(response.status, 201); series[id] = JSON.parse(response.text).series.id;
    const stored = await db.socialSeries.findUnique({ where: { id: series[id] } });
    assert.equal(stored.workspaceId, id); assert.equal(stored.dayOfWeek, 1); assert.equal(stored.dayOfMonth, 26);
    const rows = await db.socialSeriesOccurrence.findMany({ where: { seriesId: series[id] }, orderBy: { scheduledAt: 'asc' } });
    assert.deepEqual(rows.slice(0, 3).map(r => r.scheduledAt.toISOString()), id === 'a' ? ['2026-10-26T15:00:00.000Z', '2026-11-02T16:00:00.000Z', '2026-11-09T16:00:00.000Z'] : ['2026-10-25T23:00:00.000Z', '2026-11-01T23:00:00.000Z', '2026-11-08T23:00:00.000Z']);
  }
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    const snapshot = () => db.socialSeriesOccurrence.findMany({ orderBy: { id: 'asc' } });
    const before = await snapshot();
    const generate = seriesId => http(origin, `${other}.example.test`, `/api/admin/social/series/${seriesId}`, { method: 'PATCH', headers: { cookie: driver.cookie(id) }, body: { action: 'generate', through: '2026-11-10', workspaceId: other } });
    assert.equal((await generate(series[other])).status, 404);
    const retry = await generate(series[id]); assert.equal(retry.status, 200); assert.equal(JSON.parse(retry.text).created, 0); assert.deepEqual(await snapshot(), before);
    const where = { workspaceId_userId: { workspaceId: id, userId: `u${id}` } }; let pending;
    try {
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
        const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        pending = generate(series[id]).then(response => ({ response }), error => ({ error }));
        let observed = false; const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%Workspace%'`;
          if (rows.length) { observed = true; break; } await delay(25);
        }
        assert.equal(observed, true);
        await tx.workspaceMembership.update({ where, data: { status: 'REVOKED' } });
      }, { timeout: 15000 });
      const outcome = await pending; if (outcome.error) throw outcome.error;
      assert.equal(outcome.response.status, 403); assert.deepEqual(await snapshot(), before);
      cases.push({ tenant: id, companyTimezoneSchedule: true, foreignGeneration: 404, retryCreated: 0, databaseWaitObserved: true, revokedGeneration: 403, occurrencesUnchanged: true });
    } finally { await pending; await db.workspaceMembership.update({ where, data: { status: 'ACTIVE' } }); }
  }
  return { cases, providerCalls: false, hosted: false };
}
