import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return exports as T;
}

function harness() {
  let available = true;
  let queries = 0;
  const db = {
    project: { findFirst: async ({ where }: { where: { workspaceId: string } }) => { queries++; assert.equal(where.workspaceId, "a"); return available ? { id: "source", title: "Owned project", details: null } : null; } },
    blogPost: { findFirst: async ({ where }: { where: { AND: Array<{ workspaceId: string }>; status: string } }) => { queries++; assert.equal(where.AND[0].workspaceId, "a"); assert.equal(where.status, "PUBLISHED"); return available ? { id: "source", title: "Owned blog" } : null; } },
    newsletterEdition: { findFirst: async ({ where }: { where: { series: { workspaceId: string }; status: string } }) => { queries++; assert.equal(where.series.workspaceId, "a"); assert.equal(where.status, "SENT"); return available ? { id: "source", subject: "Owned newsletter", series: { name: "Owned series" }, intendedSendAt: new Date(), blocks: [] } : null; } },
  };
  const studio = load<typeof import("./social/studio")>("./social/studio.ts", {
    "@/lib/prisma": { prisma: {} }, "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) }, "./mutation-lock": {}, "@/lib/workspace-context-core": {}, "@/lib/workspace-write-access": {}, "@/app/generated/prisma/client": {}, "./core": {},
  });
  const context = load<typeof import("./social/source-context")>("./social/source-context.ts", { "server-only": {}, "@/lib/prisma": { prisma: db }, "./studio": studio });
  return { context, unavailable: () => { available = false; }, queries: () => queries };
}

test("social source context executes owned source queries and discards cached facts", async () => {
  for (const sourceType of ["PROJECT", "PORTFOLIO_ITEM", "BLOG", "NEWSLETTER"]) {
    const h = harness(); const source = { sourceType, sourceRecordIds: ["source"], sourceProjectId: null, verifiedSourceFacts: { title: "Foreign cached facts" } };
    const result = await h.context.resolveCampaignSourceContext(source, "a");
    assert.doesNotMatch(JSON.stringify(result.facts), /Foreign/); assert.match(JSON.stringify(result.facts), /Owned/); assert.equal(h.queries(), 1);
    h.unavailable(); await assert.rejects(h.context.resolveCampaignSourceContext(source, "a"), /INVALID_SOCIAL_SOURCE/);
  }
});

test("social source context rejects ambiguous references without querying and gives blank campaigns no cached property facts", async () => {
  const h = harness();
  for (const source of [
    { sourceType: "PROJECT", sourceRecordIds: [], sourceProjectId: null },
    { sourceType: "BLOG", sourceRecordIds: ["source"], sourceProjectId: "source" },
    { sourceType: "PROJECT", sourceRecordIds: ["source", "foreign"], sourceProjectId: null },
    { sourceType: "MEDIA_LIBRARY", sourceRecordIds: ["source"], sourceProjectId: null },
    { sourceType: "BLANK", sourceRecordIds: null, sourceProjectId: "foreign" },
    { sourceType: "UNKNOWN", sourceRecordIds: null, sourceProjectId: null },
  ]) await assert.rejects(h.context.resolveCampaignSourceContext(source, "a"), /INVALID_SOCIAL_SOURCE/);
  assert.equal(h.queries(), 0);
  const result = await h.context.resolveCampaignSourceContext({ sourceType: "BLANK", sourceRecordIds: [], sourceProjectId: null }, "a");
  assert.equal(JSON.stringify(result.facts), "{}");
});
