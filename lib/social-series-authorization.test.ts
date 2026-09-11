import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as core from "./social/core.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, Date, Intl, console, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return exports as T;
}

test("recurring generation authorizes and locks the owned active series before planning any occurrence", async () => {
  let allowed = false;
  let found = true;
  let writes = 0;
  const events: string[] = [];
  const tx = {
    $queryRaw: async () => { events.push("lock"); return []; },
    socialSeries: {
      findFirst: async ({ where }: { where: { workspaceId: string; status: string } }) => { events.push("read"); assert.equal(where.workspaceId, "a"); assert.equal(where.status, "ACTIVE"); return found ? { id: "series", localTime: "09:00", startsAt: new Date("2026-09-07T00:00:00Z"), endsAt: null, frequency: "WEEKLY", interval: 1, dayOfWeek: 1, dayOfMonth: null, defaultPlatforms: ["FACEBOOK"], timeZone: "UTC" } : null; },
      update: async ({ where }: { where: { workspaceId: string; status: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.status, "ACTIVE"); events.push("update"); },
    },
    socialSeriesOccurrence: { createMany: async ({ data, skipDuplicates }: { data: Array<{ seriesId: string }>; skipDuplicates: boolean }) => { assert.equal(data[0].seriesId, "series"); assert.equal(skipDuplicates, true); writes++; return { count: 1 }; } },
  };
  const api = load<typeof import("./social/series")>("./social/series.ts", {
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { events.push("access"); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
    "@/lib/client-communications/scheduling": { zonedLocalToUtc: (value: string) => new Date(value + "Z") }, "./core": core,
  });
  const call = () => api.generateSeriesOccurrences({ seriesId: "series", actor: { userId: "actor", workspaceId: "a", sessionVersion: 1 }, through: new Date("2026-09-15") });
  await assert.rejects(call(), /WORKSPACE_WRITE_FORBIDDEN/); assert.deepEqual(events, ["access"]); events.length = 0;
  allowed = true; found = false; await assert.rejects(call(), /SOCIAL_SERIES_NOT_FOUND/); assert.equal(writes, 0); assert.deepEqual(events, ["access", "lock", "read"]); events.length = 0;
  found = true; const result = await call(); assert.equal(result.created, 2); assert.equal(result.inspected, 2); assert.deepEqual(events, ["access", "lock", "read", "update"]);
});

test("series archive and reschedule reject stale access and campaign-linked occurrences", async () => {
  let allowed = false;
  let changed = 0;
  let archived = 0;
  const tx = {
    $queryRaw: async () => [],
    socialSeries: { findFirst: async ({ where }: { where: { workspaceId: string; status: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.status, "ACTIVE"); return { id: "series" }; }, update: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); archived++; } },
    socialSeriesOccurrence: { updateMany: async ({ where }: { where: { series: { workspaceId: string }; variantId: null; campaignId: null } }) => { assert.equal(where.series.workspaceId, "a"); assert.equal(where.variantId, null); assert.equal(where.campaignId, null); return { count: changed }; } },
  };
  const api = load<{ PATCH: (request: Request, context: { params: Promise<{ seriesId: string }> }) => Promise<Response> }>("../app/api/admin/social/series/[seriesId]/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a" }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
    "@/lib/social/series": {}, "@/lib/client-communications/scheduling": { zonedLocalToUtc: () => new Date("2026-09-12") },
  });
  const call = (action: string) => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ action, occurrenceId: "occurrence", scheduledLocal: "2026-09-12T09:00", workspaceId: "b" }) }), { params: Promise.resolve({ seriesId: "series" }) });
  assert.equal((await call("archive")).status, 403); assert.equal(archived, 0);
  allowed = true; assert.equal((await call("reschedule-occurrence")).status, 404); changed = 1; assert.equal((await call("reschedule-occurrence")).status, 200); assert.equal((await call("archive")).status, 200); assert.equal(archived, 1);
});

test("series creation and initial planning share one authorized transaction", async () => {
  let allowed = false;
  let writes = 0;
  let generated = 0;
  const tx = { socialSeries: { create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); writes++; return { id: "series" }; } } };
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/social/series/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a" }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } }, "@/lib/social/core": core,
    "@/lib/social/series": { normalizeSeriesFrequency: () => "WEEKLY", generateSeriesOccurrences: async (input: { actor: { workspaceId: string } }, db: unknown) => { assert.equal(db, tx); assert.equal(input.actor.workspaceId, "a"); generated++; return { created: 1 }; } },
  });
  const call = (timeZone = "UTC", endsAt = "") => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ name: "Series", startsAt: "2026-09-11", platforms: ["FACEBOOK"], timeZone, endsAt, workspaceId: "b" }) }));
  assert.equal((await call("invalid-zone")).status, 400); assert.equal((await call("UTC", "2025-01-01")).status, 400);
  assert.equal((await call()).status, 403); assert.equal(writes, 0); assert.equal(generated, 0);
  allowed = true; assert.equal((await call()).status, 201); assert.equal(writes, 1); assert.equal(generated, 1);
});
