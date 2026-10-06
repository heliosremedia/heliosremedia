import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Attempt = { workspaceId: string; revisionId: string; status: string; recipientIds: unknown; providerReceiptIds: unknown };
function fixture() {
  const state = { enabled: true, workspaces: [{ id: "a" }], attempts: [] as Attempt[], recorded: [{ id: "recipient", providerMessageId: "receipt" }], changed: 1, writes: 0 };
  const tx = { $queryRaw: async () => [], $executeRaw: async () => 0,
    workspace: { findMany: async () => state.workspaces },
    newsletterDeliveryAttempt: { findMany: async ({ where }: { where: { editionId: string } }) => { assert.equal(where.editionId, "edition"); return state.attempts; } },
    campaignRecipient: { findMany: async ({ where }: { where: { campaignId: string; status: string } }) => { assert.equal(where.campaignId, "campaign"); assert.equal(where.status, "SENT"); return state.recorded; } },
    emailCampaign: { updateMany: async ({ where, data }: { where: { id: string; rowVersion: number; newsletterDelivery: { editionId: string; revisionId: string } }; data: Record<string, unknown> }) => { assert.equal(where.id, "campaign"); assert.equal(where.rowVersion, 7); assert.equal(where.newsletterDelivery.editionId, "edition"); assert.equal(where.newsletterDelivery.revisionId, "revision"); assert.deepEqual(Object.keys(data), ["status"]); assert.equal(data.status, "SENDING"); state.writes++; return { count: state.changed }; } },
  };
  const exports: { prepareNewsletterCampaignRetry?: (tx: unknown, input: unknown) => Promise<void> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL("./delivery-campaign.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, Map, Set, require: (id: string) => { assert.ok(["server-only", "@/lib/workspace-context-core"].includes(id)); return { tenantContextEnabled: () => state.enabled }; } });
  const input = { workspaceId: "a", campaignWorkspaceId: "a" as string | null, campaignId: "campaign", campaignVersion: 7, editionId: "edition", revisionId: "revision" };
  return { state, input, run: () => exports.prepareNewsletterCampaignRetry!(tx, input) };
}
const accepted = (): Attempt => ({ workspaceId: "a", revisionId: "revision", status: "ACCEPTED", recipientIds: ["recipient"], providerReceiptIds: ["receipt"] });
test("retry preserves campaign version and only reactivates the approved owned campaign", async () => { const f=fixture(); await f.run(); assert.equal(f.state.writes,1); });
for(const status of ["PREPARED","UNCERTAIN"]) test(`${status} history rejects before campaign mutation`,async()=>{const f=fixture();f.state.attempts=[{...accepted(),status}];await assert.rejects(f.run(),/RECONCILIATION/);assert.equal(f.state.writes,0);});
test("accepted history requires every owned recipient to have its recorded receipt",async()=>{
  const f=fixture();f.state.attempts=[accepted()];await f.run();
  for(const recorded of [[],[{id:"recipient",providerMessageId:"different"}]]) {f.state.recorded=recorded;f.state.writes=0;await assert.rejects(f.run(),/RECONCILIATION/);assert.equal(f.state.writes,0);}
});
test("foreign revision/workspace and malformed receipts cannot authorize retry",async()=>{
  const changes: Partial<Attempt>[]=[{workspaceId:"b"},{revisionId:"foreign"},{status:"REJECTED"},{recipientIds:[]},{recipientIds:["recipient","recipient"]},{recipientIds:[7]},{providerReceiptIds:null},{providerReceiptIds:[]},{providerReceiptIds:[""]}];
  for(const change of changes){const f=fixture();f.state.attempts=[{...accepted(),...change}];await assert.rejects(f.run(),/RECONCILIATION/);assert.equal(f.state.writes,0);}
});
test("known rejected attempts remain retryable",async()=>{const f=fixture();f.state.attempts=[{...accepted(),status:"REJECTED",providerReceiptIds:null}];await f.run();assert.equal(f.state.writes,1);});
test("stale campaign revision or binding rejects the enclosing claim",async()=>{const f=fixture();f.state.changed=0;await assert.rejects(f.run(),/CLAIM_EXPIRED/);});
test("legacy null ownership is confined to sole matching workspace with tenant mode off",async()=>{
  const f=fixture();f.input.campaignWorkspaceId=null;await assert.rejects(f.run(),/CLAIM_EXPIRED/);f.state.enabled=false;await f.run();f.state.workspaces.push({id:"b"});await assert.rejects(f.run(),/CLAIM_EXPIRED/);f.input.campaignWorkspaceId="b";await assert.rejects(f.run(),/CLAIM_EXPIRED/);
});
