import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as normalization from "./client-communications/normalization.ts";
import * as policy from "./client-communications/workspace-consent-policy.ts";

const exports = {};
const modules: Record<string, unknown> = { "server-only": {}, "@/lib/workspace-write-access": {}, "./normalization": normalization, "./workspace-consent-policy": policy };
runInNewContext(ts.transpileModule(readFileSync(new URL("./client-communications/workspace-consent.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports, Error, Date, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
const service = exports as typeof import("./client-communications/workspace-consent");

test("scoped consent validates subscription proof and input before opening a transaction", async () => {
  const db = { $transaction: async () => { assert.fail("Invalid input reached a transaction"); } } as unknown as Parameters<typeof service.setWorkspaceMarketingPreference>[0];
  const actor = { userId: "a", workspaceId: "a", sessionVersion: 1, email: "a@example.test" };
  const valid = { clientId: "client", status: "SUBSCRIBED" as const, confirmation: true, consentSource: "Synthetic" };
  for (const extra of [{ confirmation: false }, { consentSource: " " }, { clientId: "" }, { clientId: "a".repeat(101) }, { status: "SUPPRESSED" }, { reason: {} }]) {
    await assert.rejects(service.setWorkspaceMarketingPreference(db, actor, { ...valid, ...extra } as typeof valid), /CONSENT_INVALID_INPUT/);
  }
});
test("eligibility reads normalized company identity and reveals no legacy details", async () => {
  const db = {
    workspaceMarketingPreference: { findUnique: async ({ where }: { where: unknown }) => { assert.equal(JSON.stringify(where), JSON.stringify({ workspaceId_normalizedEmail: { workspaceId: "a", normalizedEmail: "shared@example.test" } })); return { status: "SUBSCRIBED" }; } },
    marketingEmailPreference: { findUnique: async () => ({ status: "UNSUBSCRIBED", reason: "private historical detail" }) },
    communicationSuppression: { findFirst: async () => null },
  } as unknown as Parameters<typeof service.readWorkspaceMarketingEligibility>[0];
  const result = await service.readWorkspaceMarketingEligibility(db, "a", " SHARED@EXAMPLE.TEST ");
  assert.equal(JSON.stringify(result), JSON.stringify({ eligible: false, reason: "PROTECTED_BLOCK" }));
});
test("absent company or address cannot fall back to a global eligibility query", async () => {
  const db = {} as Parameters<typeof service.readWorkspaceMarketingEligibility>[0];
  assert.equal((await service.readWorkspaceMarketingEligibility(db, "", "a@example.test")).eligible, false);
  assert.equal((await service.readWorkspaceMarketingEligibility(db, "a", " ")).eligible, false);
});
