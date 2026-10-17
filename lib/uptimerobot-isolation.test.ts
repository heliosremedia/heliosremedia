import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { normalizeMonitorStatus } from "./uptimerobot-core.ts";

type Summary = { tone: string; stale: boolean; monitorName: string | null; responseTimeMs: number | null; recentIncident: string | null; lastAttemptedCheck: string | null };
function fixture() {
  const state = { tenant: false, rows: [{ id: "a" }], failDatabase: false, failProvider: false, calls: 0, reads: 0, now: 0, label: "a", env: { UPTIMEROBOT_API_KEY: "synthetic-only" } };
  class Clock extends Date { static now() { return state.now; } }
  const exports = {} as { getPublicMonitorSummary: (id: string) => Promise<Summary> };
  const fetcher = async () => { state.calls++; if (state.failProvider) throw new Error("Synthetic unavailable"); return { ok: true, json: async () => ({ data: [{ friendlyName: `Helios PRIVATE_MONITOR_${state.label}`, status: "up", responseTime: 987654321, recent_incident: `PRIVATE_INCIDENT_${state.label}` }] }) }; };
  const modules: Record<string, unknown> = { "server-only": {}, "./uptimerobot-core": { normalizeMonitorStatus }, "@/lib/workspace-context-core": { tenantContextEnabled: () => state.tenant }, "@/lib/prisma": { prisma: { workspace: { findMany: async (query: unknown) => { assert.equal(JSON.stringify(query), JSON.stringify({ take: 2, select: { id: true } })); state.reads++; if (state.failDatabase) throw new Error("Synthetic database unavailable"); return state.rows; } } } } };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./uptimerobot.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date: Clock, AbortSignal, fetch: fetcher, process: { env: state.env }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return { state, read: exports.getPublicMonitorSummary };
}
const redacted = (value: Summary) => { assert.equal(value.monitorName, null); assert.equal(value.responseTimeMs, null); assert.equal(value.recentIncident, null); assert.equal(value.lastAttemptedCheck, null); assert.equal(value.stale, false); };

test("global monitor requires matching sole-company context before provider access", async () => {
  for (const kind of ["missing", "foreign", "multiple", "tenant"]) {
    const f = fixture(); if (kind === "multiple") f.state.rows.push({ id: "b" }); if (kind === "tenant") f.state.tenant = true;
    const result = await f.read(kind === "missing" ? "" : kind === "foreign" ? "b" : "a");
    assert.equal(result.tone, "NOT_CONFIGURED"); redacted(result); assert.equal(f.state.calls, 0);
  }
});

test("warm provider cache cannot bypass provisioning or tenant-mode containment", async () => {
  for (const mode of ["multiple", "tenant", "database", "credential"]) {
    const f = fixture(); assert.equal((await f.read("a")).tone, "ONLINE"); assert.equal((await f.read("a")).tone, "ONLINE"); assert.equal(f.state.calls, 1);
    if (mode === "multiple") f.state.rows.push({ id: "b" }); if (mode === "tenant") f.state.tenant = true; if (mode === "database") f.state.failDatabase = true; if (mode === "credential") f.state.env.UPTIMEROBOT_API_KEY = "";
    redacted(await f.read("a")); assert.equal(f.state.calls, 1);
  }
});

test("provider fallback never exposes another workspace's cached value", async () => {
  const f = fixture(); await f.read("a"); f.state.rows = [{ id: "b" }]; f.state.failProvider = true;
  const result = await f.read("b"); assert.equal(result.tone, "UNKNOWN"); assert.equal(result.monitorName, null); assert.equal(result.recentIncident, null); assert.equal(result.stale, false); assert.equal(f.state.calls, 2);
});

test("attributable legacy monitor retains same-company cache and stale failure behavior", async () => {
  const f = fixture(); const first = await f.read("a"); assert.equal(first.monitorName, "Helios PRIVATE_MONITOR_a"); assert.equal((await f.read("a")).tone, "ONLINE"); assert.equal(f.state.calls, 1);
  f.state.now = 61000; f.state.failProvider = true; const stale = await f.read("a"); assert.equal(stale.stale, true); assert.equal(stale.monitorName, first.monitorName); assert.equal(f.state.calls, 2);
});
