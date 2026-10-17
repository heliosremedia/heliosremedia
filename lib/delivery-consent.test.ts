import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as normalization from "./client-communications/normalization.ts";
import * as policy from "./client-communications/workspace-consent-policy.ts";
import * as rules from "./client-communications/preference-rules.ts";

function fixture(tenantMode: boolean, workspaces = ["a", "b"]) {
  const exports = {};
  const modules: Record<string, unknown> = { "server-only": {}, "@/lib/workspace-context-core": { tenantContextEnabled: () => tenantMode }, "./normalization": normalization, "./workspace-consent-policy": policy, "./preference-rules": rules };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./client-communications/delivery-consent.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Error, Set, Map, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const api = exports as typeof import("./client-communications/delivery-consent");
  const queries: string[] = [];
  const db = {
    workspace: { findMany: async () => { queries.push("workspace"); return workspaces.map(id => ({ id })); } },
    marketingEmailPreference: { findMany: async () => [{ normalizedEmail: "legacy@example.test", status: "UNSUBSCRIBED" }, { normalizedEmail: "suppressed@example.test", status: "SUPPRESSED" }] },
    communicationSuppression: { findMany: async ({ where }: { where: { releasedAt: null } }) => { assert.equal(where.releasedAt, null); return [{ normalizedEmail: "safety@example.test" }]; } },
    workspaceMarketingPreference: { findMany: async ({ where }: { where: { workspaceId: string } }) => {
      queries.push(where.workspaceId); return ["yes", "legacy", "suppressed", "safety"].map(name => ({ normalizedEmail: `${name}@example.test`, status: where.workspaceId === "a" ? "SUBSCRIBED" : "UNSUBSCRIBED" }));
    } },
  } as unknown as Parameters<typeof api.eligibleMarketingAddresses>[0];
  return { api, db, queries };
}
const emails = [" YES@EXAMPLE.TEST ", "yes@example.test", "unknown@example.test", "legacy@example.test", "suppressed@example.test", "safety@example.test"];
for (const mode of [true, false]) test(`delivery consent uses explicit company in a two-company database (tenant mode ${mode})`, async () => {
  const { api, db } = fixture(mode);
  assert.deepEqual([...await api.eligibleMarketingAddresses(db, "a", emails)], ["yes@example.test"]);
  assert.deepEqual([...await api.eligibleMarketingAddresses(db, "b", emails)], []);
});
test("legacy eligibility is preserved only for the sole matching workspace with tenant mode off", async () => {
  const { api, db, queries } = fixture(false, ["a"]);
  assert.deepEqual([...await api.eligibleMarketingAddresses(db, "a", emails)], ["yes@example.test", "unknown@example.test"]);
  assert.deepEqual(queries, ["workspace", "a"]);
  assert.deepEqual([...await api.eligibleMarketingAddresses(db, "b", emails)], []);
});
test("tenant mode does not inherit permissive legacy consent even with one workspace", async () => {
  const { api, db, queries } = fixture(true, ["a"]);
  assert.equal(await api.workspaceAddressIsMarketingEligible(db, "a", "unknown@example.test"), false);
  assert.equal(queries.includes("workspace"), false);
});
test("missing scope fails closed and empty addresses do not query persistence", async () => {
  const { api } = fixture(true); const db = {} as Parameters<typeof api.eligibleMarketingAddresses>[0];
  await assert.rejects(api.eligibleMarketingAddresses(db, "", emails), /CONSENT_WORKSPACE_REQUIRED/);
  assert.equal((await api.eligibleMarketingAddresses(db, "a", [" "])).size, 0);
});

test("an explicit company unsubscribe also overrides sole-company legacy compatibility", async () => {
  const { api, db } = fixture(false, ["b"]);
  assert.equal(await api.workspaceAddressIsMarketingEligible(db, "b", "yes@example.test"), false);
});
