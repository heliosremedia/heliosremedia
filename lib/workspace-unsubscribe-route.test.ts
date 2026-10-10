import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function route(result: unknown = { success: true }, failure = false) {
  const calls: Array<{ kind: string; args: unknown[] }> = [], exports = {};
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/prisma": { prisma: { marketingEmailPreferenceToken: { update: async (...args: unknown[]) => calls.push({ kind: "legacy-use", args }) } } },
    "@/lib/client-communications/workspace-consent-tokens": { consumeWorkspacePreferenceToken: async (_db: unknown, ...args: unknown[]) => { calls.push({ kind: "company", args }); if (failure) throw new Error("private database and email detail"); return result; } },
    "@/lib/client-communications/preferences": {
      consumePreferenceToken: async (...args: unknown[]) => { calls.push({ kind: "legacy-read", args }); return { id: "legacy", preference: { normalizedEmail: "legacy@example.test" } }; },
      setMarketingPreference: async (...args: unknown[]) => calls.push({ kind: "legacy-write", args }),
    },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/unsubscribe/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, URL, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return { api: exports as { POST: (request: Request) => Promise<Response> }, calls };
}
const token = "v2." + "a".repeat(43);
const jsonRequest = (body: unknown) => new Request("https://a.example.test/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
test("company unsubscribe ignores submitted company, client and email selectors", async () => {
  const { api, calls } = route(); const response = await api.POST(jsonRequest({ token, reason: "Optional", workspaceId: "foreign", email: "foreign@example.test", clientId: "foreign" }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true }); assert.deepEqual(calls, [{ kind: "company", args: [token, "Optional"] }]);
});
test("one-click form requests accept the company token from the query", async () => {
  const { api, calls } = route(); const response = await api.POST(new Request(`https://a.example.test/api/unsubscribe?token=${token}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }));
  assert.equal(response.status, 200); assert.equal(calls[0].args[0], token);
});
for (const failure of [false, true]) test(`invalid or failed company token never falls back to legacy (failure ${failure})`, async () => {
  const { api, calls } = route(null, failure); const response = await api.POST(jsonRequest({ token: "v2.malformed" }));
  assert.equal(response.status, 400); assert.doesNotMatch(await response.text(), /private|database|@/); assert.deepEqual(calls.map(c => c.kind), ["company"]);
});
test("legacy public tokens retain their original global preference path", async () => {
  const { api, calls } = route(); const response = await api.POST(jsonRequest({ token: "a".repeat(43), reason: "old scope" }));
  assert.equal(response.status, 200); assert.deepEqual(calls.map(c => c.kind), ["legacy-read", "legacy-write", "legacy-use"]);
  const input = calls[1].args[0] as { email: string; status: string }; assert.equal(input.email, "legacy@example.test"); assert.equal(input.status, "UNSUBSCRIBED");
});
test("malformed public bodies return safe errors without a mutation", async () => {
  const { api, calls } = route(); assert.equal((await api.POST(jsonRequest(null))).status, 400); assert.deepEqual(calls, []);
});
