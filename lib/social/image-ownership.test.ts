import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("Social AI image attachment rejects a foreign record and ignores a forged URL", async () => {
  let writes = 0;
  let cover = "";
  const exports: { PATCH?: (request: Request, context: unknown) => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: Response },
    "@/lib/auth/session": { getAdminSession: async () => ({ userId: "actor", role: "ADMIN" }) },
    "@/lib/workspaces": { requireWorkspaceId: async () => "a" },
    "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/social/core": {}, "@/lib/client-communications/scheduling": {}, "@/lib/social/publishing": {},
    "@/lib/social/studio": { updateVariantContent: async ({ data }: { data: { suggestedCover: string } }) => { cover = data.suggestedCover; } },
    "@/lib/prisma": { prisma: {
      socialVariant: { findFirst: async () => ({ status: "DRAFT" }) },
      newsletterImageAsset: { findFirst: async ({ where }: { where: { id: string; AND: Array<{ workspaceId: string }> } }) => {
        assert.equal(where.AND[0].workspaceId, "a");
        return where.id === "own" ? { id: "own", publicUrl: "https://assets.example/own.webp", model: "test" } : null;
      } },
      $transaction: async (fn: (tx: unknown) => Promise<void>) => fn({ socialGeneratedAsset: { create: async () => { writes++; } } }),
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../../app/api/admin/social/campaigns/[campaignId]/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, console, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`);
    return modules[id];
  } });
  const request = (assetId: string) => new Request("https://studio.example/api", { method: "PATCH", body: JSON.stringify({ action: "set-ai-image", variantId: "variant", assetId, url: "https://foreign.example/image.webp" }) });
  const context = { params: Promise.resolve({ campaignId: "campaign" }) };
  assert.equal((await exports.PATCH!(request("foreign"), context)).status, 404);
  assert.equal(writes, 0);
  assert.equal((await exports.PATCH!(request("own"), context)).status, 200);
  assert.equal(writes, 1);
  assert.equal(cover, "https://assets.example/own.webp");
});
