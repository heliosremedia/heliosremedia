import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function fixture() {
  const media = (id: string, owner = "a", storageKey = `projects/${id}/image.webp`) => ({ id, projectId: id, project: { workspaceId: owner, title: id }, visibility: "VISIBLE", storageKey, externalUrl: null, altText: "", originalFilename: "", mimeType: "image/webp", aspectRatio: 1 });
  const own = media("own"); const foreign = media("foreign", "b"); const forged = media("forged", "a", "projects/foreign/image.webp");
  const variant = { id: "variant", hashtags: [], scheduledAt: null, publishedAt: null, suggestedCover: "https://assets.test/cover.webp", generatedAssets: [{ workspaceId: "a", publicUrl: "https://assets.test/cover.webp", sourceMedia: own as typeof own | null }], media: [own, foreign, forged].map(item => ({ id: item.id, mediaId: item.id, media: item })) };
  let authenticated = true;
  let found = true;
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": { jsx: (_type: unknown, props: unknown) => props },
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } }, "./SocialCampaignEditor": {},
    "@/lib/auth/session": { getAdminSession: async () => authenticated ? { workspaceId: "a", userId: "actor" } : null },
    "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.test/${key}` },
    "@/lib/social/publishing-payload": { publishingStorageReferenceMatches: (_ws: string, id: string, key: string) => key.startsWith(`projects/${id}/`) },
    "@/lib/prisma": { prisma: {
      socialCampaign: { findFirst: async ({ where, include }: { where: { workspaceId: string }; include: { variants: { include: { media: { where: { media: { project: { workspaceId: string } } } }; generatedAssets: { where: { workspaceId: string } } } } } }) => { assert.equal(where.workspaceId, "a"); assert.equal(include.variants.include.media.where.media.project.workspaceId, "a"); assert.equal(include.variants.include.generatedAssets.where.workspaceId, "a"); return found ? { id: "campaign", variants: [variant] } : null; } },
      media: { findMany: async ({ where }: { where: { project: { workspaceId: string } } }) => { assert.equal(where.project.workspaceId, "a"); return [own, foreign, forged]; } },
      socialConnection: { findMany: async ({ where, select }: { where: { workspaceId: string }; select: Record<string, boolean> }) => { assert.equal(where.workspaceId, "a"); assert.equal("encryptedTokenPayload" in select, false); return []; } },
    } },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/admin/social-studio/campaigns/[campaignId]/page.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; }, Error, Date, Intl });
  const page = exports as { default: (props: { params: Promise<{ campaignId: string }> }) => Promise<{ library: Array<{ id: string; altText: string }>; initialCampaign: { variants: Array<{ suggestedCover: string; media: Array<{ mediaId: string }> }> } }> };
  return { variant, foreign, call: () => page.default({ params: Promise.resolve({ campaignId: "campaign" }) }), logout: () => { authenticated = false; }, missing: () => { found = false; } };
}

test("social editor excludes foreign links and forged storage prefixes before serializing client props", async () => {
  const h = fixture(); const result = await h.call();
  assert.equal(JSON.stringify(result.library.map(item => item.id)), '["own"]');
  assert.equal(JSON.stringify(result.initialCampaign.variants[0].media.map(item => item.mediaId)), '["own"]');
  assert.equal(result.library[0].altText, "Company media");
  h.logout(); await assert.rejects(h.call(), /NOT_FOUND/);
  const missing = fixture(); missing.missing(); await assert.rejects(missing.call(), /NOT_FOUND/);
});

test("social editor shows a generated cover only with an owned matching asset and owned source media", async () => {
  const h = fixture(); assert.equal((await h.call()).initialCampaign.variants[0].suggestedCover, h.variant.suggestedCover);
  h.variant.generatedAssets[0].workspaceId = "b"; assert.equal((await h.call()).initialCampaign.variants[0].suggestedCover, "");
  h.variant.generatedAssets[0].workspaceId = "a"; h.variant.generatedAssets[0].sourceMedia = h.foreign; assert.equal((await h.call()).initialCampaign.variants[0].suggestedCover, "");
  h.variant.generatedAssets = []; assert.equal((await h.call()).initialCampaign.variants[0].suggestedCover, "");
});
