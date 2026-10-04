import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return exports as T;
}
function harness() {
  let currentRole = "ADMIN", owned = true, tenant = false, companies = ["a"], ambiguous = false, status = "UNSUBSCRIBED", suppressed = false, auditFailure = false;
  let writes = 0, audits = 0, locks = 0;
  const tx = {
    $executeRaw: async () => { locks++; },
    workspace: { findMany: async () => companies.map(id => ({ id })) },
    communicationClient: {
      findFirst: async ({ where }: { where: { workspaceMemberships: { some: { workspaceId: string } } } }) => { assert.equal(where.workspaceMemberships.some.workspaceId, "a"); return owned ? { id: "client", displayName: "Synthetic", email: "a@example.test", normalizedEmail: "a@example.test" } : null; },
      count: async () => ambiguous ? 1 : 0,
    },
    marketingEmailPreference: { findUnique: async () => ({ status }) },
    communicationSuppression: { findFirst: async () => suppressed ? { id: "safety" } : null },
    auditEvent: { create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); if (auditFailure) throw Error("private-database-error"); audits++; } },
  };
  const service = load<typeof import("./client-communications/admin-preference")>("./client-communications/admin-preference.ts", {
    "server-only": {}, "@/lib/prisma": { prisma: { $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => {
      const before = { writes, audits }; try { return await fn(tx); } catch (error) { writes = before.writes; audits = before.audits; throw error; }
    } } },
    "@/lib/workspace-context-core": { tenantContextEnabled: () => tenant },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { if (!["ADMIN", "OWNER"].includes(currentRole)) throw Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "./preferences": { setMarketingPreference: async (input: { status: string }, client: unknown) => { assert.equal(client, tx); writes++; return { normalizedEmail: "a@example.test", status: input.status }; } },
  });
  const route = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/clients/preferences/route.ts", {
    "next/cache": { revalidatePath: () => {} }, "next/server": { NextResponse: Response },
    "@/lib/auth/session": { getAdminSession: async () => ({ userId: "u", workspaceId: "a", role: "ADMIN", sessionVersion: 1, email: "admin@example.test" }) },
    "@/lib/client-communications/admin-preference": service,
  });
  return {
    set: (options: { role?: string; owned?: boolean; tenant?: boolean; companies?: readonly string[]; ambiguous?: boolean; status?: string; suppressed?: boolean; auditFailure?: boolean }) => {
      currentRole = options.role ?? currentRole; owned = options.owned ?? owned; tenant = options.tenant ?? tenant; companies = options.companies ? [...options.companies] : companies;
      ambiguous = options.ambiguous ?? ambiguous; status = options.status ?? status; suppressed = options.suppressed ?? suppressed; auditFailure = options.auditFailure ?? auditFailure;
    },
    state: () => ({ writes, audits, locks }),
    call: (extra = {}) => route.POST(new Request("https://synthetic.test", { method: "POST", body: JSON.stringify({ clientId: "client", action: "resubscribe", confirmation: true, consentSource: "Synthetic", ...extra }) })),
  };
}
for (const [name,options,status] of [
  ["foreign client", { owned: false }, 404], ["revoked administrator", { role: "REVOKED" }, 403], ["demoted editor", { role: "EDITOR" }, 403],
  ["tenant mode", { tenant: true }, 409], ["multiple companies", { companies: ["a", "b"] }, 409], ["wrong sole company", { companies: ["b"] }, 409],
  ["unattributed same-address client", { ambiguous: true }, 409], ["suppressed preference", { status: "SUPPRESSED" }, 409], ["active safety suppression", { suppressed: true }, 409],
] as const) test(`admin consent rejects ${name} before preference and audit writes`, async () => {
  const h = harness(); h.set({ ...options, ...("companies" in options ? { companies: [...options.companies] } : {}) });
  for (const action of ["unsubscribe", "resubscribe"]) { const result = await h.call({ action }); assert.equal(result.status, status); }
  assert.equal(h.state().writes, 0); assert.equal(h.state().audits, 0);
});
test("attributed single-company legacy changes preserve their transaction and audit", async () => {
  const h = harness();
  for (const action of ["unsubscribe", "resubscribe"]) assert.equal((await h.call({ action })).status, 200);
  assert.deepEqual(h.state(), { writes: 2, audits: 2, locks: 2 });
});
test("audit failure rolls back the preference and returns a sanitized error", async () => {
  const h = harness(); h.set({ auditFailure: true }); const result = await h.call();
  assert.equal(result.status, 500); assert.doesNotMatch(await result.text(), /private-database-error/); assert.equal(h.state().writes, 0);
});
test("invalid confirmation and non-string fields cannot reach preference writes", async () => {
  const h = harness(); for (const input of [{ confirmation: "yes" }, { reason: {} }, { consentSource: {} }, { clientId: {} }]) assert.equal((await h.call(input)).status, 400);
  assert.equal(h.state().writes, 0);
});
