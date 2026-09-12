import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function harness() {
  let available = true;
  let calls = 0;
  const exports: { refreshNewsletterBlockSources?: (workspaceId: string, sources: unknown[], content: Record<string, unknown>) => Promise<Array<{ id: string; excerpt: string; imageCandidates: unknown[] }>>; newsletterBlockAuthoringContext?: (content: Record<string, unknown>) => Record<string, unknown> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {}, "./content-sources": { collectVerifiedNewsletterSources: async (workspaceId: string, selection: { blogPostIds: string[]; projectIds: string[]; serviceIds: string[]; includeWebsiteContent: boolean }) => {
      calls++; assert.equal(workspaceId, "a"); assert.deepEqual(Array.from(selection.blogPostIds), ["post"]); assert.deepEqual(Array.from(selection.projectIds), ["project"]); assert.deepEqual(Array.from(selection.serviceIds), ["service"]); assert.equal(selection.includeWebsiteContent, true);
      return available ? [
        { id: "blog:post", kind: "BLOG_POST" }, { id: "project:project", kind: "PROJECT" },
        { id: "service:service", kind: "SERVICE" }, { id: "website:site-settings", kind: "WEBSITE_CONTENT" },
      ].map(item => ({ ...item, label: "Current company title", excerpt: "Current company facts", imageCandidates: [] })) : [];
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./block-source-context.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return { api: exports, unavailable: () => { available = false; }, calls: () => calls };
}

test("block sources use fresh owned records instead of cached snapshots and titles", async () => {
  const { api, unavailable, calls } = harness();
  const stored = [
    { id: "1", sourceId: "blog:post", sourceType: "BLOG_POST" },
    { id: "2", sourceId: "project:project", sourceType: "PROJECT" },
    { id: "3", sourceId: "service:service", sourceType: "SERVICE" },
    { id: "4", sourceId: "website:site-settings", sourceType: "WEBSITE_CONTENT" },
  ].map(item => ({ ...item, sourceTitle: "Private stale title", sourceSnapshot: { excerpt: "Private stale facts", imageCandidates: ["foreign"] } }));
  const result = await api.refreshNewsletterBlockSources!("a", stored, {});
  assert.equal(result.length, 4); assert.equal(JSON.stringify(result).includes("Private stale"), false);
  assert.equal(result.every(item => item.excerpt === "Current company facts"), true);
  unavailable(); await assert.rejects(api.refreshNewsletterBlockSources!("a", stored, {}), /no longer available/);
  assert.equal(calls(), 2);
  await assert.rejects(api.refreshNewsletterBlockSources!("a", [{ id: "bad", sourceId: "project:foreign", sourceType: "BLOG_POST" }], {}), /identity must be verified/);
  assert.equal(calls(), 2);
});

test("manual sources and rewrite context contain authored copy without cached image metadata", async () => {
  const { api, calls } = harness();
  const content = { heading: "Owned heading", body: "Owned body", imageCandidates: [{ label: "Private stale title" }], imageUrl: "https://foreign.example/image.png", sourceSnapshot: "Private stale facts", alignment: "left" };
  const context = api.newsletterBlockAuthoringContext!(content);
  assert.deepEqual(JSON.parse(JSON.stringify(context)), { heading: "Owned heading", body: "Owned body", alignment: "left" });
  const sources = await api.refreshNewsletterBlockSources!("a", [{ id: "manual", sourceId: null, sourceType: "ADMIN_CONTENT", sourceSnapshot: { excerpt: "Private stale facts" } }], content);
  assert.equal(sources[0].id, "block-source:manual"); assert.match(sources[0].excerpt, /Owned body/);
  assert.equal(JSON.stringify(sources).includes("Private stale"), false); assert.equal(sources[0].imageCandidates.length, 0);
  assert.equal(calls(), 0);
});
