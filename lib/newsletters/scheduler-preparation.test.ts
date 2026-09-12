import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const now = new Date('2026-09-12T12:00:00Z');
const sendAt = new Date('2026-09-25T16:00:00Z');
const generationAt = new Date('2026-09-18T08:00:00Z');

function fixture(options: { paused?: boolean; foreign?: boolean; legacy?: boolean; ambiguous?: boolean; existing?: boolean; rollback?: boolean; manual?: boolean } = {}) {
  const events: string[] = [];
  const jobs: Array<{ type: string; dueAt: Date; idempotencyKey: string }> = [];
  let editionCreate: Record<string, unknown> | undefined;
  let seriesUpdate: Record<string, unknown> | undefined;
  const scope = options.legacy ? { OR: [{ workspaceId: 'a' }, { workspaceId: null }] } : { workspaceId: 'a' };
  const series = {
    id: 'series-a', createdById: 'creator', timeZone: 'UTC', nextSendAt: null, nextGenerationAt: null,
    sendRecurrenceKind: 'DAY_OF_MONTH', sendDayOfMonth: 25, sendLocalTime: '16:00',
    generationMode: options.manual ? 'MANUAL' : 'DAYS_BEFORE_SEND', generationDaysBeforeSend: 7, generationLocalTime: '08:00',
  };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      assert.match(sql, /FOR UPDATE/);
      if (sql.includes('"Workspace"')) {
        events.push('workspace-lock'); assert.deepEqual(values, ['a']); return [{ id: 'a' }];
      }
      events.push('series-lock');
      assert.match(sql, /"workspaceId" IS NULL/);
      assert.deepEqual(values, ['series-a', 'a', Boolean(options.legacy)]);
      return options.foreign ? [] : [{ id: 'series-a' }];
    },
    newsletterSeries: {
      findFirst: async ({ where }: { where: unknown }) => {
        assert.deepEqual(events, ['discover', 'resolve-owner', 'transaction', 'workspace-lock', 'scope', 'series-lock']);
        assert.equal(JSON.stringify(where), JSON.stringify({ id: 'series-a', status: 'ACTIVE', AND: [scope] }));
        events.push('fresh-config'); return options.paused ? null : series;
      },
      update: async ({ where, data }: { where: unknown; data: Record<string, unknown> }) => {
        assert.equal(JSON.stringify(where), JSON.stringify({ id: 'series-a', AND: [scope] }));
        events.push('series-update'); seriesUpdate = data;
        if (options.rollback) throw new Error('transaction aborted');
      },
    },
    newsletterEdition: {
      findUnique: async () => options.existing ? { id: 'edition', status: 'NEEDS_REVIEW', intendedSendAt: new Date('2026-09-27T17:00:00Z'), generationDueAt: new Date('2026-09-20T09:00:00Z') } : null,
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: unknown }) => {
        events.push('edition'); assert.equal(JSON.stringify(update), '{}'); editionCreate = create; return { id: 'edition' };
      },
    },
    newsletterJob: { createMany: async ({ data, skipDuplicates }: { data: typeof jobs; skipDuplicates: boolean }) => {
      events.push('jobs'); assert.equal(skipDuplicates, true); jobs.push(...data);
    } },
  };
  const modules: Record<string, unknown> = {
    'server-only': {}, 'node:crypto': {},
    './ownership': { resolveNewsletterWorkspace: async (owner: unknown) => {
      events.push('resolve-owner'); assert.equal(owner, options.legacy || options.ambiguous ? null : 'a');
      if (options.ambiguous) throw new Error('ownership must be configured');
      return 'a';
    } },
    '@/lib/blog-ownership': { getContentOwnershipScope: async (owner: string) => { events.push('scope'); assert.equal(owner, 'a'); return scope; } },
    './recurrence': {
      nextOccurrence: (_now: Date, rule: { dayOfMonth: number }, zone: string) => { assert.equal(rule.dayOfMonth, 25); assert.equal(zone, 'UTC'); return sendAt; },
      generationDateForSend: (_date: Date, rule: { mode: string; daysBeforeSend?: number }) => {
        if (rule.mode === 'MANUAL') return null;
        assert.equal(rule.daysBeforeSend, 7); return generationAt;
      },
    },
    '@/lib/prisma': { prisma: {
      newsletterSeries: { findMany: async ({ select }: { select: unknown }) => {
        events.push('discover'); assert.equal(JSON.stringify(select), JSON.stringify({ id: true, workspaceId: true }));
        return [{ id: 'series-a', workspaceId: options.legacy || options.ambiguous ? null : 'a' }];
      } },
      $transaction: async (fn: (client: typeof tx) => Promise<number>) => {
        events.push('transaction');
        try { const value = await fn(tx); events.push('commit'); return value; }
        catch (error) { events.push('rollback'); throw error; }
      },
    } },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('./scheduler.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, Intl, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  const api = exports as { ensureUpcomingNewsletterEditions: (now: Date) => Promise<number> };
  return { run: () => api.ensureUpcomingNewsletterEditions(now), events, jobs, edition: () => editionCreate, series: () => seriesUpdate };
}

test('recurrence preparation locks stored ownership before fresh active configuration and counts committed editions', async () => {
  for (const legacy of [false, true]) {
    const f = fixture({ legacy });
    assert.equal(await f.run(), 1);
    assert.equal(f.events.at(-1), 'commit');
    assert.equal(f.edition()?.intendedSendAt, sendAt);
    assert.equal(f.edition()?.generationDueAt, generationAt);
    assert.deepEqual(f.jobs.map(job => job.idempotencyKey), ['newsletter:generate:edition', 'newsletter:missed-approval:edition']);
    assert.equal(f.series()?.nextSendAt, sendAt);
  }
});

test('recurrence discovery cannot override a paused or foreign series', async () => {
  for (const options of [{ paused: true }, { foreign: true }]) {
    const f = fixture(options);
    assert.equal(await f.run(), 0);
    assert.equal(f.edition(), undefined); assert.equal(f.series(), undefined); assert.equal(f.jobs.length, 0);
    if (options.foreign) assert.equal(f.events.includes('fresh-config'), false);
  }
});

test('ambiguous ownerless recurrence fails before transaction or preparation', async () => {
  const f = fixture({ ambiguous: true });
  await assert.rejects(f.run(), /ownership must be configured/);
  assert.deepEqual(f.events, ['discover', 'resolve-owner']); assert.equal(f.jobs.length, 0);
});

test('existing manually rescheduled edition supplies job dates and is never rewritten or counted as new', async () => {
  const f = fixture({ existing: true });
  assert.equal(await f.run(), 0);
  assert.equal(f.jobs[0].dueAt.toISOString(), '2026-09-20T09:00:00.000Z');
  assert.equal(f.jobs[1].dueAt.toISOString(), '2026-09-27T17:00:00.000Z');
  assert.equal((f.series()?.nextSendAt as Date).toISOString(), '2026-09-27T17:00:00.000Z');
});

test('manual recurrence has no generation job and failed transaction cannot report a successful count', async () => {
  const manual = fixture({ manual: true });
  assert.equal(await manual.run(), 1); assert.deepEqual(manual.jobs.map(job => job.type), ['MISSED_APPROVAL']);
  const failed = fixture({ rollback: true });
  await assert.rejects(failed.run(), /transaction aborted/);
  assert.equal(failed.events.includes('commit'), false); assert.equal(failed.events.at(-1), 'rollback');
});
