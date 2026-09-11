import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as core from "./social/core.ts";

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, URL, Date, console, ...globals,
  });
  return exports as T;
}

test("social generation claim checks company, request and editable variants before starting", async () => {
  let present = false;
  let claimed = 0;
  let stale = false;
  const campaign = { id: "campaign", status: "DRAFT", generationStatus: null as string | null, generationRequestId: null as string | null, variants: [{ id: "variant", status: "DRAFT", contentVersion: 3 }] };
  const tx = { socialCampaign: {
    findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => { assert.equal(where.id, "campaign"); assert.equal(where.workspaceId, "a"); return present ? campaign : null; },
    updateMany: async ({ where, data }: { where: { workspaceId: string; generationStatus: string | null }; data: { generationStatus: string; generationRequestId: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.generationStatus, campaign.generationStatus); assert.equal(data.generationRequestId, "request"); if (stale) return { count: 0 }; claimed++; return { count: 1 }; },
  } };
  const api = load<typeof import("./social/generation-ownership")>("./social/generation-ownership.ts", {
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => {} },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const actor = { userId: "actor", workspaceId: "a", sessionVersion: 1 };
  const call = (variantId?: string) => api.claimSocialGeneration(actor, "campaign", "request", variantId);
  await assert.rejects(call(), /SOCIAL_CAMPAIGN_NOT_FOUND/); present = true;
  await assert.rejects(call("foreign"), /SOCIAL_VARIANT_NOT_FOUND/);
  campaign.variants[0].status = "PUBLISHED"; await assert.rejects(call(), /SOCIAL_GENERATION_LOCKED/);
  campaign.variants[0].status = "DRAFT"; campaign.generationStatus = "RUNNING"; await assert.rejects(call(), /SOCIAL_GENERATION_BUSY/);
  campaign.generationStatus = "SUCCEEDED"; campaign.generationRequestId = "request"; assert.equal((await call()).duplicate, true); assert.equal(claimed, 0);
  campaign.generationStatus = null; campaign.generationRequestId = null; stale = true; await assert.rejects(call(), /SOCIAL_GENERATION_BUSY/); assert.equal(claimed, 0);
  stale = false; const result = await call(); assert.equal(result.duplicate, false); assert.equal(claimed, 1);
});

test("late social generation failures cannot overwrite a newer company's request", async () => {
  let changed = false;
  const api = load<typeof import("./social/generation-ownership")>("./social/generation-ownership.ts", {
    "@/lib/workspace-write-access": {}, "@/lib/prisma": { prisma: { socialCampaign: { updateMany: async ({ where }: { where: { workspaceId: string; generationRequestId: string; generationStatus: string } }) => {
      assert.equal(where.workspaceId, "a"); assert.equal(where.generationRequestId, "old-request"); assert.equal(where.generationStatus, "RUNNING"); changed = true; return { count: 0 };
    } } } },
  });
  const result = await api.failSocialGeneration("a", "campaign", "old-request", "Failed safely"); assert.equal(result.count, 0); assert.equal(changed, true);
});

test("social generation uses company identity and commits through the existing guarded transaction", async () => {
  let claimError = "SOCIAL_CAMPAIGN_NOT_FOUND";
  let current = true;
  let editError = "";
  let fetches = 0;
  let edits = 0;
  let completed = 0;
  let failures = 0;
  const variant = { id: "variant", platform: "FACEBOOK", status: "APPROVED", caption: "Before", contentVersion: 3 };
  const campaign = { id: "campaign", verifiedSourceFacts: {}, variants: [variant] };
  const brief = { positioning: "Creative direction", themes: ["Photography"], cadence: "Weekly", formats: ["Post"], platformConsiderations: "Clear copy", callsToAction: "Learn more" };
  const tx = { socialCampaign: {
    findFirst: async ({ where }: { where: { workspaceId: string; generationRequestId: string; generationStatus: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.generationRequestId, "request"); assert.equal(where.generationStatus, "RUNNING"); return current ? { id: "campaign" } : null; },
    update: async ({ where, data }: { where: { workspaceId: string; generationRequestId: string }; data: { generationStatus: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.generationRequestId, "request"); assert.equal(data.generationStatus, "SUCCEEDED"); completed++; },
  } };
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/social/ai/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a", userId: "actor", sessionVersion: 7 }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => {} }, "@/lib/social/core": core,
    "@/lib/social/grounding": { socialDraftText: JSON.stringify, deterministicallyGroundSocialDrafts: (value: unknown) => ({ value }) },
    "@/lib/social/generation-ownership": {
      claimSocialGeneration: async (actor: { workspaceId: string }) => { assert.equal(actor.workspaceId, "a"); if (claimError) throw new Error(claimError); return { duplicate: false, campaign, chosen: [variant] }; },
      failSocialGeneration: async (workspaceId: string, campaignId: string, requestId: string) => { assert.equal(workspaceId, "a"); assert.equal(campaignId, "campaign"); assert.equal(requestId, "request"); failures++; },
    },
    "@/lib/social/studio": {
      ensureSocialSettings: async () => ({ brandVoice: "Company voice", writingGuardrails: "Use facts", primaryAudience: "Agents" }),
      updateVariantContent: async (input: { workspaceId: string; expectedContentVersion: number; actorSessionVersion: number; data: Record<string, unknown> }, transaction: unknown) => {
        assert.equal(transaction, tx); assert.equal(input.workspaceId, "a"); assert.equal(input.expectedContentVersion, 3); assert.equal(input.actorSessionVersion, 7); assert.equal("status" in input.data, false);
        if (editError) throw new Error(editError); edits++;
      },
    },
    "@/lib/prisma": { prisma: { workspace: { findUniqueOrThrow: async ({ where }: { where: { id: string } }) => { assert.equal(where.id, "a"); return { name: "Company A" }; } }, $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  }, {
    DOMException, AbortSignal: { timeout: () => undefined }, process: { env: { OPENAI_API_KEY: "fake-test-key" } },
    fetch: async (_url: string, options: { body: string }) => {
      fetches++; const body = JSON.parse(options.body);
      if (body.text.format.type === "json_object") { assert.match(body.instructions, /Social Studio for Company A/); assert.doesNotMatch(body.instructions, /Helios/); return Response.json({ output_text: JSON.stringify({ campaignBrief: brief, FACEBOOK: { caption: "New draft" } }) }); }
      return Response.json({ output_text: JSON.stringify({ campaignBrief: brief, platforms: { FACEBOOK: { caption: "Grounded draft" } }, unsupportedClaims: [] }) });
    },
  });
  const call = () => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ campaignId: "campaign", requestId: "request", workspaceId: "b" }) }));
  assert.equal((await call()).status, 404); assert.equal(fetches, 0);
  claimError = "WORKSPACE_WRITE_FORBIDDEN"; assert.equal((await call()).status, 403); assert.equal(fetches, 0);
  claimError = ""; current = false; assert.equal((await call()).status, 409); assert.equal(edits, 0); assert.equal(completed, 0);
  current = true; editError = "SOCIAL_EDIT_CONFLICT"; assert.equal((await call()).status, 409); assert.equal(edits, 0); assert.equal(completed, 0);
  editError = ""; assert.equal((await call()).status, 200); assert.equal(edits, 1); assert.equal(completed, 1); assert.equal(failures, 2);
});

test("new company social defaults omit Helios branding and geographic assumptions", async () => {
  let enabled = true;
  let companies = [{ id: "a" }];
  const api = load<typeof import("./social/studio")>("./social/studio.ts", {
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled }, "@/lib/workspace-write-access": {}, "@/lib/blog-ownership": {}, "@/app/generated/prisma/client": {}, "./core": core,
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => companies }, socialStudioSettings: { upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => { assert.equal(Object.keys(update).length, 0); return create; } } } },
  });
  let settings = await api.ensureSocialSettings("a"); assert.doesNotMatch(JSON.stringify(settings), /Helios|Northern Colorado/);
  enabled = false; settings = await api.ensureSocialSettings("a"); assert.match(JSON.stringify(settings), /Helios/);
  companies = [{ id: "a" }, { id: "b" }]; settings = await api.ensureSocialSettings("a"); assert.doesNotMatch(JSON.stringify(settings), /Helios|Northern Colorado/);
});
