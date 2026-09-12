import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as images from "./newsletters/source-images.ts";
import * as gallery from "./newsletters/gallery-projects.ts";

test("actual Newsletter picker filters foreign storage and derives AI URLs from keys", async () => {
  const exports: { GET?: (request: Request) => Promise<Response> } = {};
  const media = ["mine", "foreign"].map((owner) => ({ id: owner, projectId: "p", storageKey: `workspaces/${owner}/image.png`, project: { title: "Project", slug: "project" } }));
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: Response },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/media-collections": { getMediaCollection: () => ({ label: "Photo" }) },
    "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    "@/lib/newsletters/gallery-projects": gallery,
    "@/lib/newsletters/source-images": images,
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ workspaceId: "mine" }) },
    "@/lib/prisma": { prisma: {
      media: { findMany: async ({ where }: { where: { project: { workspaceId: string } } }) => { assert.equal(where.project.workspaceId, "mine"); return media; } },
      blogPost: { findMany: async ({ where }: { where: { AND: { workspaceId: string }[] } }) => {
        assert.equal(where.AND[0].workspaceId, "mine");
        return ["mine", "foreign"].map(owner => ({ id: owner, title: owner, slug: owner, featuredImageStorageKey: `workspaces/${owner}/blog/image.png` }));
      } },
      newsletterImageAsset: { findMany: async ({ where }: { where: { AND: { workspaceId: string }[] } }) => {
        assert.equal(where.AND[0].workspaceId, "mine");
        return ["mine", "foreign"].map(owner => ({ id: owner, storageKey: `workspaces/${owner}/newsletter-ai/image.png`, publicUrl: "javascript:alert(1)" }));
      } },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/admin/newsletters/images/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, Date, console, process: { env: {} }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  const response = await exports.GET!(new Request("https://studio.example/api/admin/newsletters/images"));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.items.map((item: { id: string }) => item.id), ["ai:mine", "media:mine", "blog:mine"]);
  assert.equal(result.items[0].url, "https://assets.example/workspaces/mine/newsletter-ai/image.png");
});

test("actual edition save rejects foreign storage even on company-scoped image rows", async () => {
  for (const source of ["AI", "PORTFOLIO", "BLOG"]) {
    const exports: { saveEdition?: (id: string, input: unknown, actorId: string, workspaceId: string) => Promise<unknown> } = {};
    const key = "workspaces/foreign/blog/image.png";
    let writes = 0;
    const modules: Record<string, unknown> = {
      "@/lib/newsletters/source-image-validation": { verifyNewsletterSourceImageSelections: async () => {} },
      "@/lib/newsletters/source-images": images,
      "@/lib/r2-upload": { getPublicAssetUrl: (value: string) => `https://assets.example/${value}` },
      "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      "@/lib/newsletters/types": { NEWSLETTER_BLOCK_TYPES: ["HERO"] },
      "@/lib/prisma": { prisma: {
        newsletterEdition: { findUnique: async () => ({ status: "DRAFT", blocks: [], approvals: [] }) },
        newsletterImageAsset: { findMany: async () => [{ id: "asset", storageKey: key, publicUrl: `https://assets.example/${key}` }] },
        media: { findMany: async () => [{ id: "asset", projectId: "mine", storageKey: key }] },
        blogPost: { findMany: async () => [{ id: "asset", featuredImageStorageKey: key }] },
        $transaction: async () => { writes++; throw new Error("Unexpected write"); },
      } },
    };
    const code = readFileSync(new URL("../app/api/admin/newsletters/editions/[editionId]/route.ts", import.meta.url), "utf8") + "\nexport { saveEdition };";
    runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, URL, Date, Error, process: { env: {} }, require: (id: string) => modules[id] ?? {},
    });
    await assert.rejects(exports.saveEdition!("edition", {
      subject: "Subject", blocks: [{ type: "HERO", imageUrl: `https://assets.example/${key}`, imageSelection: { mode: source === "AI" ? "AI" : "GALLERY", assetSource: source, assetId: "asset" } }],
    }, "user", "mine"), /image is no longer available/);
    assert.equal(writes, 0);
  }
});

test("edition save cannot bypass custom or source checks by selecting AUTO", async () => {
  for (const mode of ["CUSTOM", "AUTO"]) {
    const exports: { saveEdition?: (id: string, input: unknown, actorId: string, workspaceId: string) => Promise<unknown> } = {};
    let customChecks = 0;
    const modules: Record<string, unknown> = {
      "@/lib/newsletters/types": { NEWSLETTER_BLOCK_TYPES: ["HERO"] },
      "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) },
      "@/lib/newsletters/custom-image-ownership": { verifyNewsletterCustomImage: async (input: { workspaceId: string; url: string }) => {
        customChecks++; assert.equal(input.workspaceId, "a"); assert.equal(input.url, "https://assets.example/workspaces/b/image.png");
        throw new Error("The custom image is not available to this company.");
      } },
      "@/lib/prisma": { prisma: { newsletterEdition: { findUnique: async () => ({ status: "NEEDS_REVIEW", blocks: [], approvals: [] }) } } },
    };
    const code = readFileSync(new URL("../app/api/admin/newsletters/editions/[editionId]/route.ts", import.meta.url), "utf8") + "\nexport { saveEdition };";
    runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, URL, Error, require: (id: string) => modules[id] ?? {},
    });
    await assert.rejects(exports.saveEdition!("edition", { subject: "Subject", blocks: [{ type: "HERO", imageUrl: "https://assets.example/workspaces/b/image.png", imageSelection: { mode } }] }, "actor", "a"), /(?:custom image is not available|source image is no longer available)/);
    assert.equal(customChecks, mode === "CUSTOM" ? 1 : 0);
  }
});
