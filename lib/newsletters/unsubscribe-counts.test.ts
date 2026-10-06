import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const exports = {} as { readCampaignUnsubscribeCounts: (tx: unknown, workspaceId: string, ids: string[]) => Promise<Map<string, number>> };
runInNewContext(ts.transpileModule(readFileSync(new URL("./unsubscribe-counts.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (id: string) => { assert.equal(id, "server-only"); return {}; } });

test("unsubscribe aggregate scopes both histories and deduplicates addresses across protocols", async () => {
  const row = (campaignId: string | null, normalizedEmail: string) => ({ campaignId, preference: { normalizedEmail } });
  let queries = 0;
  const query = (company: boolean) => async (args: { where: { workspaceId?: string; campaignId: { in: string[] }; status: string }; select: unknown }) => {
    queries++; assert.equal(args.where.workspaceId, company ? "a" : undefined);
    assert.deepEqual(Array.from(args.where.campaignId.in), ["current", "previous"]); assert.equal(args.where.status, "UNSUBSCRIBED");
    assert.equal(JSON.stringify(args.select), JSON.stringify({ campaignId: true, preference: { select: { normalizedEmail: true } } }));
    return company ? [row("current", "same@example.test"), row("current", "new@example.test"), row("current", "new@example.test"), row(null, "old@example.test")] : [row("current", "same@example.test"), row("previous", "same@example.test")];
  };
  const result = await exports.readCampaignUnsubscribeCounts({ marketingEmailPreferenceEvent: { findMany: query(false) }, workspaceMarketingPreferenceEvent: { findMany: query(true) } }, "a", ["current", "previous"]);
  assert.equal(queries, 2); assert.equal(result.get("current"), 2); assert.equal(result.get("previous"), 1); assert.doesNotMatch(JSON.stringify([...result]), /@/);
});

test("empty or missing authority cannot query global history", async () => {
  assert.equal((await exports.readCampaignUnsubscribeCounts({}, "", ["campaign"])).size, 0);
  assert.equal((await exports.readCampaignUnsubscribeCounts({}, "a", [])).size, 0);
});
