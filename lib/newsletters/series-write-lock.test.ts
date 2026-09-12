import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(file: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Intl, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}

test("series settings lock rejects foreign identity, stale access and active or retryable work", async () => {
  let allowed = true;
  let own = true;
  let busyJob = false;
  let status = "SCHEDULED";
  let legacy = false;
  let seriesReads = 0;
  const events: string[] = [];
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray, ...params: unknown[]) => {
      const query = sql.join("?"); events.push("lock"); assert.match(query, /FOR UPDATE/);
      if (query.includes('FROM "NewsletterSeries"')) { assert.deepEqual(params, ["series", "a", legacy]); return own ? [{ id: "series" }] : []; }
      assert.equal(params[0], "series"); return [];
    },
    newsletterEdition: { findFirst: async ({ where }: { where: { seriesId: string; status: { in: string[] } } }) => { assert.equal(where.seriesId, "series"); return where.status.in.includes(status) ? { id: "edition" } : null; } },
    newsletterJob: { findFirst: async ({ where }: { where: { edition: { seriesId: string }; status: string } }) => { assert.equal(where.edition.seriesId, "series"); assert.equal(where.status, "CLAIMED"); return busyJob ? { id: "job" } : null; } },
    newsletterSeries: { findUnique: async () => { seriesReads++; return { id: "series" }; } },
  };
  const api = load<{ lockNewsletterSeriesSettings: (tx: unknown, id: string, actor: unknown) => Promise<unknown> }>("./series-write-lock.ts", {
    "server-only": {},
    "@/lib/blog-ownership": { getContentOwnershipScope: async () => legacy ? { OR: [{ workspaceId: "a" }, { workspaceId: null }] } : { workspaceId: "a" } },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { events.push("authorize"); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
  });
  const call = () => api.lockNewsletterSeriesSettings(tx, "series", { workspaceId: "a" });
  await call(); assert.deepEqual(events.splice(0), ["authorize", "lock", "lock", "lock"]); assert.equal(seriesReads, 1);
  allowed = false; await assert.rejects(call(), /FORBIDDEN/); assert.deepEqual(events.splice(0), ["authorize"]); allowed = true;
  own = false; await assert.rejects(call(), /not found/); assert.deepEqual(events.splice(0), ["authorize", "lock"]); own = true;
  busyJob = true; await assert.rejects(call(), /SERIES_BUSY/); busyJob = false;
  for (status of ["GENERATING", "SENDING", "SEND_FAILED", "PARTIALLY_SENT"]) await assert.rejects(call(), /SERIES_BUSY/);
  assert.equal(seriesReads, 1);
  status = "SCHEDULED"; legacy = true; await call(); assert.equal(seriesReads, 2);
});

test("series creation captures its actor and rechecks administrator access before audience or writes", async () => {
  let allowed = false;
  let writes = 0;
  let audienceReads = 0;
  const actor = { userId: "actor", workspaceId: "a", sessionVersion: 1 };
  const tx = {
    communicationGroup: { count: async () => { audienceReads++; actor.workspaceId = "b"; return 0; } },
    communicationClient: { count: async () => 0 },
    newsletterSeries: { create: async ({ data }: { data: { workspaceId: string; createdById: string } }) => { assert.equal(data.workspaceId, "a"); assert.equal(data.createdById, "actor"); writes++; return { id: "series" }; } },
    newsletterEdition: { create: async ({ data }: { data: { seriesId: string } }) => { assert.equal(data.seriesId, "series"); writes++; return { id: "edition" }; } },
    newsletterJob: { create: async () => { writes++; } },
  };
  const api = load<{ createSeries: (input: unknown, actor: unknown) => Promise<unknown> }>("./studio.ts", {
    "server-only": {}, "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/newsletters/ownership": {}, "./series-write-lock": {}, "./recipients": {}, "./content-hash": {},
    "./recurrence": { nextOccurrence: () => new Date("2027-01-01"), generationDateForSend: () => null },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async (_tx: unknown, captured: { workspaceId: string }) => { assert.equal(captured.workspaceId, "a"); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx) } },
  });
  const input = { name: "Series", sendRule: "SECOND_THURSDAY_09:00", generationRule: "MANUAL" };
  await assert.rejects(api.createSeries(input, actor), /FORBIDDEN/); assert.equal(writes, 0); assert.equal(audienceReads, 0);
  allowed = true; await api.createSeries(input, actor); assert.equal(writes, 3); assert.equal(audienceReads, 1);
});
