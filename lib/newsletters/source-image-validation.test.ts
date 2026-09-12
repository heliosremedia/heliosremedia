import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as sourceImages from "./source-images.ts";
import type { NewsletterSourceReference } from "./ai.ts";

function load(file: string, modules: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports;
}

test("source collector filters foreign storage, hidden featured media and mismatched service covers", async () => {
  const media = (id: string, storageKey: string) => ({ id, storageKey, projectId: "p", visibility: "VISIBLE", displayOrder: 0, mediaCategory: "PHOTO", project: { workspaceId: "a", status: "PUBLISHED", archivedAt: null } });
  const collect = load("./content-sources.ts", {
    "server-only": {}, "@/lib/workspace-context-core": { tenantContextEnabled: () => true },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/site": {}, "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    "@/lib/external-media": { tryResolveExternalMedia: () => null }, "./source-images": sourceImages,
    "@/lib/prisma": { prisma: {
      blogPost: { findMany: async () => [{ id: "b", title: "Blog", slug: "b", featuredImageStorageKey: "workspaces/a/blog/image.png", featuredMedia: { ...media("hidden", "projects/p/hidden.png"), visibility: "HIDDEN", altText: "Private alt", width: 999 } }] },
      project: { findMany: async ({ where }: { where: { archivedAt: unknown } }) => { assert.equal(where.archivedAt, null); return [{ id: "p", title: "Project", slug: "p", thumbnailMediaId: "cover", media: [media("other", "projects/other/image.png"), media("foreign", "workspaces/b/media/image.png"), media("cover", "projects/p/cover.png")] }]; } },
      service: { findMany: async () => [{ id: "s", name: "Service", slug: "s", heroImageStorageKey: "workspaces/b/site-brand/image.png", projects: [{ project: { id: "p", title: "Project", slug: "p", thumbnailMedia: { ...media("cover", "projects/p/cover.png"), projectId: "other" } } }] }] },
      siteSettings: { findUnique: async () => ({ websiteUrl: "https://company-a.example" }) },
    } },
  }).collectVerifiedNewsletterSources;
  const sources = await collect("a", { blogPostIds: ["b"], projectIds: ["p"], serviceIds: ["s"] }) as NewsletterSourceReference[];
  assert.equal(sources[0].imageCandidates?.[0].url, "https://assets.example/workspaces/a/blog/image.png");
  assert.equal(sources[0].imageCandidates?.[0].altText, undefined);
  assert.equal(sources[0].imageCandidates?.[0].width, undefined);
  assert.deepEqual(Array.from(sources[1].imageCandidates ?? [], image => image.id), ["project:p:media:cover"]);
  assert.equal(sources[2].imageCandidates?.length, 0);
});

test("source image revalidation uses persisted identities and each block's own source list", async () => {
  let available = true;
  const verify = load("./source-image-validation.ts", {
    "server-only": {}, "./content-sources": { collectVerifiedNewsletterSources: async (workspaceId: string, selection: { projectIds: string[] }) => {
      assert.equal(workspaceId, "a"); assert.deepEqual(Array.from(selection.projectIds), ["p"]);
      return available ? [{ id: "project:p", imageCandidates: [{ id: "project:p:media:m", url: "https://assets.example/projects/p/m.png" }] }] : [];
    } },
  }).verifyNewsletterSourceImageSelections;
  const selection = { candidateId: "project:p:media:m", url: "https://assets.example/projects/p/m.png", sources: [{ sourceType: "PROJECT", sourceId: "project:p" }] };
  await verify("a", [selection]);
  await assert.rejects(verify("a", [selection, { ...selection, sources: [] }]), /no longer available/);
  await assert.rejects(verify("a", [{ ...selection, url: "https://foreign.example/image.png" }]), /no longer available/);
  available = false;
  await assert.rejects(verify("a", [selection]), /no longer available/);
});
