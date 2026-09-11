import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as core from "./social/core.ts";
import { resolveMembershipAccess } from "./workspace-membership-core.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, URL, Date, console,
  });
  return exports as T;
}

test("transaction editor authorization rechecks membership, session version and company after locking", async () => {
  let enabled = true;
  let user = { id: "actor", workspaceId: "a", active: true, role: "OWNER" as const, sessionVersion: 1 };
  let status = "ACTIVE";
  let role: "EDITOR" | "VIEWER" = "EDITOR";
  const locks: string[] = [];
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray) => { locks.push(sql.join("?")); return []; },
    adminUser: { findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.id, "actor"); return user.workspaceId === where.workspaceId ? user : null; } },
    workspaceMembership: { findUnique: async () => ({ userId: "actor", workspaceId: "a", status, role }) },
  };
  const api = load<{ requireLockedWorkspaceEditor: (client: typeof tx, actor: { userId: string; workspaceId: string; sessionVersion: number }) => Promise<void> }>("./workspace-write-access.ts", {
    "./workspace-context-core.ts": { tenantContextEnabled: () => enabled }, "./workspace-membership-core.ts": { resolveMembershipAccess },
  });
  const actor = { userId: "actor", workspaceId: "a", sessionVersion: 1 };
  await api.requireLockedWorkspaceEditor(tx, actor); assert.match(locks[0], /Workspace/); assert.match(locks[1], /AdminUser/); assert.match(locks[2], /WorkspaceMembership/);
  status = "REVOKED"; await assert.rejects(api.requireLockedWorkspaceEditor(tx, actor), /WORKSPACE_WRITE_FORBIDDEN/);
  status = "ACTIVE"; role = "VIEWER"; await assert.rejects(api.requireLockedWorkspaceEditor(tx, actor), /WORKSPACE_WRITE_FORBIDDEN/);
  role = "EDITOR"; user = { ...user, sessionVersion: 2 }; await assert.rejects(api.requireLockedWorkspaceEditor(tx, actor), /WORKSPACE_WRITE_FORBIDDEN/);
  user = { ...user, sessionVersion: 1, active: false }; await assert.rejects(api.requireLockedWorkspaceEditor(tx, actor), /WORKSPACE_WRITE_FORBIDDEN/);
  user = { ...user, active: true, workspaceId: "b" }; await assert.rejects(api.requireLockedWorkspaceEditor(tx, actor), /WORKSPACE_WRITE_FORBIDDEN/);
  user = { ...user, workspaceId: "a" }; enabled = false; await api.requireLockedWorkspaceEditor(tx, actor);
});

function editingHarness() {
  const state = { own: true, forbidden: false, inFlight: false, status: "APPROVED", version: 3, mediaOwn: true, imageOwn: true, writes: 0, revoked: 0, snapshots: 0, cancelled: 0, assets: 0, selection: [] as string[], order: [] as string[] };
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray) => { const variant = sql.join("").includes("SELECT v.id"); state.order.push(variant ? "variant-lock" : "job-lock"); return variant && state.own ? [{ id: "variant" }] : []; },
    socialVariant: {
      findFirstOrThrow: async ({ where }: { where: { campaign: { workspaceId: string } } }) => { assert.equal(where.campaign.workspaceId, "a"); return { id: "variant", campaignId: "campaign", status: state.status, contentVersion: state.version }; },
      update: async ({ where, data }: { where: { campaign: { workspaceId: string }; contentVersion: number }; data: { contentVersion: { increment: number }; approvedAt: null; approvalActorId: null; status: string } }) => {
        assert.equal(where.campaign.workspaceId, "a"); assert.equal(where.contentVersion, 3); assert.equal(data.contentVersion.increment, 1); assert.equal(data.approvedAt, null); assert.equal(data.approvalActorId, null); state.writes++; return { id: "variant", status: data.status, contentVersion: 4 };
      },
    },
    socialPublishingJob: {
      findFirst: async ({ where }: { where: { variant: { campaign: { workspaceId: string } } } }) => { assert.equal(where.variant.campaign.workspaceId, "a"); return state.inFlight ? { id: "job" } : null; },
      updateMany: async ({ where }: { where: { variant: { campaign: { workspaceId: string } }; claimToken: null } }) => { assert.equal(where.variant.campaign.workspaceId, "a"); assert.equal(where.claimToken, null); state.cancelled++; return { count: 1 }; },
    },
    socialPublishingSnapshot: { updateMany: async ({ where }: { where: { variant: { campaign: { workspaceId: string } } } }) => { assert.equal(where.variant.campaign.workspaceId, "a"); state.snapshots++; return { count: 1 }; } },
    socialApprovalEvent: { create: async ({ data }: { data: { action: string; contentVersion: number } }) => { assert.equal(data.action, "REVOKED"); assert.equal(data.contentVersion, 4); state.revoked++; } },
    socialCampaign: { update: async ({ where }: { where: { workspaceId: string; id: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.id, "campaign"); } },
    socialVariantMedia: {
      updateMany: async ({ where }: { where: { variantId: string; media: { project: { workspaceId: string } } } }) => { assert.equal(where.variantId, "variant"); assert.equal(where.media.project.workspaceId, "a"); return { count: state.mediaOwn ? 1 : 0 }; },
      deleteMany: async () => {},
      createMany: async ({ data }: { data: Array<{ mediaId: string; displayOrder: number }> }) => { state.selection = data.map((item, i) => { assert.equal(item.displayOrder, i); return item.mediaId; }); },
    },
    socialCampaignMedia: { createMany: async () => {} },
    media: { findMany: async ({ where }: { where: { project: { workspaceId: string } } }) => { assert.equal(where.project.workspaceId, "a"); return state.mediaOwn ? [{ id: "second", altText: "Second" }, { id: "first", altText: "First" }] : []; } },
    newsletterImageAsset: { findFirst: async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => { assert.equal(where.AND[0].workspaceId, "a"); return state.imageOwn ? { id: "image", model: "test", publicUrl: "https://assets.example.test/owned.webp" } : null; } },
    socialGeneratedAsset: { create: async ({ data }: { data: { workspaceId: string; variantId: string } }) => { assert.equal(data.workspaceId, "a"); assert.equal(data.variantId, "variant"); state.assets++; } },
  };
  const api = load<typeof import("./social/studio")>("./social/studio.ts", {
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { state.order.push("access-lock"); if (state.forbidden) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/app/generated/prisma/client": {}, "./core": core,
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const input = { variantId: "variant", workspaceId: "a", actorId: "actor", actorSessionVersion: 1, expectedContentVersion: 3, data: {} };
  return { state, api, input };
}

test("social content mutation rejects foreign, revoked, stale, published and in-flight edits", async () => {
  const { state, api, input } = editingHarness();
  state.forbidden = true; await assert.rejects(api.updateVariantContent(input), /WORKSPACE_WRITE_FORBIDDEN/);
  state.forbidden = false; state.own = false; await assert.rejects(api.updateVariantContent(input), /SOCIAL_VARIANT_NOT_FOUND/);
  state.own = true; state.version = 4; await assert.rejects(api.updateVariantContent(input), /SOCIAL_EDIT_CONFLICT/);
  state.version = 3; state.status = "PUBLISHED"; await assert.rejects(api.updateVariantContent(input), /immutable/);
  state.status = "APPROVED"; state.inFlight = true; await assert.rejects(api.updateVariantContent(input), /SOCIAL_PUBLICATION_IN_PROGRESS/);
  await assert.rejects(api.updateVariantContent({ ...input, data: { campaignId: "foreign" } }), /INVALID_SOCIAL_CONTENT/);
  assert.equal(state.writes, 0); assert.equal(state.revoked, 0); assert.equal(state.cancelled, 0);
});

test("crop and alt-text edits revoke approval, invalidate snapshots and cancel unclaimed jobs in one guarded transaction", async () => {
  const { state, api, input } = editingHarness();
  const change = { kind: "MEDIA_PRESENTATION" as const, relationId: "relation", data: { altText: "New alt", cropAspect: null, cropX: 0.2, cropY: 0.3, cropScale: 1 } };
  state.mediaOwn = false; await assert.rejects(api.updateVariantContent({ ...input, change }), /INVALID_SOCIAL_MEDIA/); assert.equal(state.writes, 0);
  state.mediaOwn = true; state.order = [];
  const result = await api.updateVariantContent({ ...input, change });
  assert.equal(result.status, "NEEDS_REVIEW"); assert.equal(state.writes, 1); assert.equal(state.revoked, 1); assert.equal(state.snapshots, 1); assert.equal(state.cancelled, 1);
  assert.deepEqual(state.order, ["access-lock", "job-lock", "variant-lock"]);
});

test("social media selection preserves requested order and rejects foreign assets", async () => {
  const { state, api, input } = editingHarness();
  state.mediaOwn = false; await assert.rejects(api.updateVariantContent({ ...input, change: { kind: "MEDIA_SELECTION", mediaIds: ["first", "second"] } }), /INVALID_SOCIAL_MEDIA/);
  assert.equal(state.writes, 0); state.mediaOwn = true;
  await api.updateVariantContent({ ...input, change: { kind: "MEDIA_SELECTION", mediaIds: ["first", "second"] } });
  assert.deepEqual(Array.from(state.selection), ["first", "second"]); assert.equal(state.revoked, 1);
});

test("AI cover attachment checks stored company and changes approval in the same transaction", async () => {
  const { state, api, input } = editingHarness();
  state.imageOwn = false; await assert.rejects(api.updateVariantContent({ ...input, change: { kind: "AI_IMAGE", assetId: "foreign" } }), /SOCIAL_IMAGE_NOT_FOUND/);
  assert.equal(state.assets, 0); assert.equal(state.writes, 0);
  state.imageOwn = true; await api.updateVariantContent({ ...input, change: { kind: "AI_IMAGE", assetId: "owned" } });
  assert.equal(state.assets, 1); assert.equal(state.writes, 1); assert.equal(state.revoked, 1);
});

test("social API keeps session ownership and version when changing media presentation", async () => {
  let found = false;
  let edits = 0;
  const api = load<{ PATCH: (request: Request, context: { params: Promise<{ campaignId: string }> }) => Promise<Response> }>("../app/api/admin/social/campaigns/[campaignId]/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/workspace-write-access": {},
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a", userId: "actor", sessionVersion: 7 }) },
    "@/lib/social/core": core, "@/lib/client-communications/scheduling": {}, "@/lib/social/publishing": {},
    "@/lib/prisma": { prisma: { socialVariant: { findFirst: async ({ where }: { where: { campaignId: string; campaign: { workspaceId: string } } }) => { assert.equal(where.campaign.workspaceId, "a"); assert.equal(where.campaignId, "campaign"); return found ? { status: "APPROVED", contentVersion: 3 } : null; } } } },
    "@/lib/social/studio": { updateVariantContent: async (input: { workspaceId: string; actorSessionVersion: number; expectedContentVersion: number; change: { kind: string } }) => { assert.equal(input.workspaceId, "a"); assert.equal(input.actorSessionVersion, 7); assert.equal(input.expectedContentVersion, 3); assert.equal(input.change.kind, "MEDIA_PRESENTATION"); edits++; } },
  });
  const call = () => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ action: "update-media-presentation", variantId: "variant", mediaRelationId: "relation", workspaceId: "b" }) }), { params: Promise.resolve({ campaignId: "campaign" }) });
  assert.equal((await call()).status, 404); assert.equal(edits, 0); found = true;
  assert.equal((await call()).status, 200); assert.equal(edits, 1);
});

test("social approval rechecks actor access and rejects an obsolete content revision", async () => {
  let access = false;
  let stale = true;
  let checked = 0;
  const tx = {
    socialVariant: { update: async ({ where }: { where: { campaign: { workspaceId: string }; contentVersion: number; status: string } }) => {
      assert.equal(checked > 0, true); assert.equal(where.campaign.workspaceId, "a"); assert.equal(where.contentVersion, 3); assert.equal(where.status, "NEEDS_REVIEW");
      if (stale) throw Object.assign(new Error("stale"), { code: "P2025" }); return {};
    } }, socialApprovalEvent: { create: async () => ({}) }, socialGeneratedAsset: { updateMany: async () => ({ count: 0 }) }, socialCampaign: { update: async () => ({}) },
  };
  const api = load<{ PATCH: (request: Request, context: { params: Promise<{ campaignId: string }> }) => Promise<Response> }>("../app/api/admin/social/campaigns/[campaignId]/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { if (!access) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); checked++; } },
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a", userId: "actor", sessionVersion: 1 }) },
    "@/lib/social/core": core, "@/lib/client-communications/scheduling": {}, "@/lib/social/publishing": {}, "@/lib/social/studio": {},
    "@/lib/prisma": { prisma: {
      socialVariant: { findFirst: async () => ({ id: "variant", status: "NEEDS_REVIEW", contentVersion: 3, caption: "Approved copy", postType: "TEXT_POST", _count: { media: 0 } }), count: async () => 0 },
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    } },
  });
  const call = () => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ action: "approve", variantId: "variant" }) }), { params: Promise.resolve({ campaignId: "campaign" }) });
  assert.equal((await call()).status, 403); access = true; assert.equal((await call()).status, 409); stale = false; assert.equal((await call()).status, 200);
});
