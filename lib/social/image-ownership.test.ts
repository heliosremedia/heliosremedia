import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as core from "./core.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, console, Error, Date, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`); return modules[id]; },
  });
  return exports as T;
}

test("Social AI image attachment rejects a foreign record and ignores a forged URL", async () => {
  let writes = 0;
  let cover = "";
  const variant = { id: "variant", campaignId: "campaign", status: "DRAFT", contentVersion: 1 };
  const tx = {
    $queryRaw: async () => [{ id: "variant" }],
    socialVariant: { findFirstOrThrow: async () => variant, update: async ({ data }: { data: { suggestedCover: string } }) => { cover = data.suggestedCover; return variant; } },
    socialPublishingJob: { findFirst: async () => null, updateMany: async () => ({ count: 0 }) },
    socialPublishingSnapshot: { updateMany: async () => ({ count: 0 }) }, socialCampaign: { update: async () => ({}) },
    newsletterImageAsset: { findFirst: async ({ where }: { where: { id: string; AND: Array<{ workspaceId: string }> } }) => {
      assert.equal(where.AND[0].workspaceId, "a"); return where.id === "own" ? { id: "own", publicUrl: "https://assets.example/own.webp", model: "test" } : null;
    } },
    socialGeneratedAsset: { create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); writes++; } },
  };
  const access = { requireLockedWorkspaceEditor: async (_tx: unknown, actor: { workspaceId: string }) => { assert.equal(actor.workspaceId, "a"); } };
  const mutationLock = load<typeof import("./mutation-lock")>("./mutation-lock.ts", {});
  const studio = load<typeof import("./studio")>("./studio.ts", {
    "@/lib/workspace-write-access": access, "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/workspace-context-core": {}, "@/app/generated/prisma/client": {}, "./core": core, "./mutation-lock": mutationLock,
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const api = load<{ PATCH: (request: Request, context: { params: Promise<{ campaignId: string }> }) => Promise<Response> }>("../../app/api/admin/social/campaigns/[campaignId]/route.ts", {
    "@/lib/social/campaign-duplication": {},
    "@/lib/social/mutation-lock": mutationLock,
    "next/server": { NextResponse: Response }, "@/lib/workspace-write-access": access,
    "@/lib/auth/session": { getAdminSession: async () => ({ userId: "actor", role: "ADMIN", workspaceId: "a", sessionVersion: 1 }) },
    "@/lib/social/core": core, "@/lib/client-communications/scheduling": {}, "@/lib/social/publishing": {}, "@/lib/social/studio": studio,
    "@/lib/prisma": { prisma: { socialVariant: { findFirst: async () => variant } } },
  });
  const request = (assetId: string) => new Request("https://studio.example/api", { method: "PATCH", body: JSON.stringify({ action: "set-ai-image", variantId: "variant", assetId, url: "https://foreign.example/image.webp", workspaceId: "b" }) });
  const context = { params: Promise.resolve({ campaignId: "campaign" }) };
  assert.equal((await api.PATCH(request("foreign"), context)).status, 404); assert.equal(writes, 0);
  assert.equal((await api.PATCH(request("own"), context)).status, 200); assert.equal(writes, 1); assert.equal(cover, "https://assets.example/own.webp");
});
