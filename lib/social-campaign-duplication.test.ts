import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function harness() {
  let allowed = true;
  let found = true;
  let sourceAllowed = true;
  let writes = 0;
  const media = { projectId: "project", project: { workspaceId: "a" }, visibility: "VISIBLE", storageKey: "projects/project/image.webp" };
  const source = {
    internalName: "Campaign", sourceType: "PROJECT", sourceRecordIds: ["project"] as unknown, verifiedSourceFacts: { stale: "foreign details" }, sourceProjectId: "project", sourceProject: { workspaceId: "a" }, selectedPlatforms: ["FACEBOOK"],
    projects: [{ projectId: "project", project: { workspaceId: "a" } }], media: [{ mediaId: "media", displayOrder: 0, media }],
    variants: [{ platform: "FACEBOOK", postType: "IMAGE_POST", caption: "Reviewed text", approvedAt: new Date(), scheduledAt: new Date(), status: "PUBLISHED", suggestedCover: "https://foreign.test/image", aiMetadata: { generatedImageAssetId: "foreign" }, media: [{ mediaId: "media", displayOrder: 0, altText: "Photo", cropX: 20, media }] }],
  };
  let saved: Record<string, unknown> | null = null;
  const tx = {
    $queryRaw: async () => [],
    socialCampaign: {
      findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return found ? source : null; },
      create: async ({ data }: { data: Record<string, unknown> }) => { writes++; saved = data; return { id: "copy" }; },
    },
  };
  const exports = {};
  const modules: Record<string, unknown> = {
    "server-only": {}, "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "./studio": { verifiedSourceFacts: async (_type: string, id: string, workspaceId: string, db: unknown) => { assert.equal(id, "project"); assert.equal(workspaceId, "a"); assert.equal(db, tx); if (!sourceAllowed) throw new Error("missing"); return { title: "Current owned facts" }; } },
    "./publishing-payload": { publishingStorageReferenceMatches: (workspaceId: string, projectId: string, key: string) => key === `projects/${projectId}/image.webp` && workspaceId === "a" },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./social/campaign-duplication.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; }, Error });
  const api = exports as typeof import("./social/campaign-duplication");
  return { source, media, call: () => api.duplicateSocialCampaign("campaign", { userId: "actor", workspaceId: "a", sessionVersion: 1 }), setAllowed: (value: boolean) => { allowed = value; }, setFound: (value: boolean) => { found = value; }, setSourceAllowed: (value: boolean) => { sourceAllowed = value; }, getWrites: () => writes, getSaved: () => saved! };
}

test("campaign duplication rejects revoked access and foreign campaign/source/media relationships before writes", async () => {
  const access = harness(); access.setAllowed(false); await assert.rejects(access.call(), /WORKSPACE_WRITE_FORBIDDEN/); assert.equal(access.getWrites(), 0);
  const missing = harness(); missing.setFound(false); await assert.rejects(missing.call(), /SOCIAL_CAMPAIGN_NOT_FOUND/); assert.equal(missing.getWrites(), 0);
  const cases: Array<(h: ReturnType<typeof harness>) => void> = [
    h => { h.source.sourceProject.workspaceId = "b"; },
    h => { h.source.projects[0].project.workspaceId = "b"; },
    h => { h.media.project.workspaceId = "b"; },
    h => { h.media.visibility = "HIDDEN"; },
    h => { h.media.storageKey = "projects/foreign/image.webp"; },
    h => { h.source.sourceRecordIds = ["foreign"]; },
    h => { h.source.sourceRecordIds = { id: "project" }; },
    h => { h.source.sourceRecordIds = ["project", "foreign"]; },
    h => { h.source.sourceType = "MEDIA_LIBRARY"; },
    h => { h.setSourceAllowed(false); },
  ];
  for (const mutate of cases) { const h = harness(); mutate(h); await assert.rejects(h.call(), /INVALID_SOCIAL_SOURCE/); assert.equal(h.getWrites(), 0); }
});

test("campaign copies preserve authored content and media order but never approval, schedule or unverified AI assets", async () => {
  const h = harness(); await h.call(); const data = h.getSaved();
  assert.equal(data.workspaceId, "a"); assert.equal(data.createdById, "actor"); assert.equal(data.status, "DRAFT");
  assert.equal(JSON.stringify(data.verifiedSourceFacts), JSON.stringify({ title: "Current owned facts" }));
  const variants = (data.variants as { create: Array<Record<string, unknown>> }).create;
  assert.equal(variants[0].caption, "Reviewed text"); assert.equal(variants[0].status, "DRAFT");
  for (const field of ["approvedAt", "approvalActorId", "scheduledAt", "publishedAt", "publicUrl"]) assert.equal(field in variants[0], false);
  assert.equal(variants[0].suggestedCover, null); assert.equal(variants[0].aiMetadata, undefined);
  assert.equal(((variants[0].media as { create: Array<{ cropX: number }> }).create)[0].cropX, 20);
});
