import * as deliveryApproval from "./delivery-approval.ts";
import * as sourceImages from "./source-images.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("background ownership uses stored identity and fails closed on ambiguous legacy data", async () => {
  let enabled = true;
  let rows = [{ id: "other" }];
  let reads = 0;
  const exports: { resolveNewsletterWorkspace?: (id: string | null) => Promise<string>; requireNewsletterApprovalWorkspace?: (snapshot: unknown, id: string | null) => Promise<string> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => { reads++; return rows; } } } },
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./ownership.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (id: string) => modules[id] });
  const approval = exports.requireNewsletterApprovalWorkspace!;
  assert.equal(await approval({ workspaceId: "a" }, "a"), "a");
  await assert.rejects(approval({ workspaceId: "b" }, "a"));
  await assert.rejects(approval({ workspaceId: null }, "a"));
  await assert.rejects(approval({}, "a"));
  const resolve = exports.resolveNewsletterWorkspace!;
  assert.equal(await resolve("original-company"), "original-company");
  assert.equal(reads, 0);
  await assert.rejects(resolve(null));
  enabled = false;
  assert.equal(await resolve(null), "other");
  assert.equal(await approval({}, "other"), "other");
  await assert.rejects(approval({}, "a"));
  rows = [{ id: "other" }, { id: "second" }];
  await assert.rejects(resolve(null));
  rows = [];
  await assert.rejects(resolve(null));
});

test("actual source collector scopes requested IDs and derives company links", async () => {
  const records = ["a", "b"].map(workspaceId => ({ id: `post-${workspaceId}`, workspaceId, title: workspaceId, slug: workspaceId, content: "Copy", excerpt: "Intro", featuredMedia: null }));
  const exports: { collectVerifiedNewsletterSources?: (id: string, selection: unknown) => Promise<Array<{ id: string; url: string }>> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/workspace-context-core": { tenantContextEnabled: () => true },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/site": { getSiteUrl: () => { throw new Error("Global site fallback forbidden"); } },
    "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    "@/lib/external-media": { tryResolveExternalMedia: () => null },
    "./source-images": sourceImages,
    "@/lib/prisma": { prisma: {
      blogPost: { findMany: async ({ where }: { where: { AND: Array<{ workspaceId: string }>; id: { in: string[] } } }) => records.filter(row => row.workspaceId === where.AND[0].workspaceId && where.id.in.includes(row.id)) },
      project: { findMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return []; } },
      service: { findMany: async ({ where }: { where: { workspaceId: string; projects?: unknown } }) => { assert.equal(where.workspaceId, "a"); return []; } },
      siteSettings: { findUnique: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return { businessName: "Company A", websiteUrl: "https://company-a.example" }; } },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./content-sources.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`);
    return modules[id];
  } });
  const result = await exports.collectVerifiedNewsletterSources!("a", { blogPostIds: ["post-a", "post-b"], projectIds: ["foreign-project"], serviceIds: ["foreign-service"], includeWebsiteContent: true });
  assert.equal(result.some(row => row.id === "blog:post-b"), false);
  assert.equal(result.find(row => row.id === "blog:post-a")?.url, "https://company-a.example/blog/a");
});

test("Newsletter admin guard keeps unfinished workflows unavailable to a second company", async () => {
  let session: { role: string; workspaceId: string } | null = null;
  let rows = [{ id: "a" }];
  const exports: { requireNewsletterAdministrator?: () => Promise<unknown> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {}, "next/server": { NextResponse: Response },
    "@/lib/blog-ownership": {}, "./studio": {}, "./recipients": {},
    "@/lib/auth/session": { getAdminSession: async () => session },
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => rows } } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./api.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (id: string) => modules[id] });
  const guard = exports.requireNewsletterAdministrator!;
  assert.equal(await guard(), null);
  session = { role: "EDITOR", workspaceId: "a" };
  assert.equal(await guard(), null);
  session = { role: "ADMIN", workspaceId: "a" };
  assert.equal(await guard(), session);
  rows = [{ id: "a" }, { id: "b" }];
  assert.equal(await guard(), null);
  rows = [{ id: "b" }];
  assert.equal(await guard(), null);
});

test("actual delivery aborts a foreign approval before recipients, tokens or provider calls", async () => {
  const exports: { deliverApprovedNewsletter?: (id: string, context: unknown) => Promise<unknown> } = {};
  let providerCalls = 0;
  const modules: Record<string, unknown> = {
    "@/lib/client-communications/providers/resend-core": {},
    "./delivery-approval": deliveryApproval, "./delivery-access": {},
    "server-only": {}, "node:crypto": {}, "./recipient-identity": {}, "@/lib/client-communications/campaign-ownership": {},
    "@/lib/newsletters/ownership": { requireNewsletterApprovalWorkspace: async () => { throw new Error("Foreign approval"); } },
    "@/lib/prisma": { prisma: { newsletterEdition: { findUnique: async () => ({ id: "edition", currentRevisionNumber: 1, intendedSendAt: new Date("2027-01-01"), status: "SCHEDULED", series: { status: "ACTIVE", workspaceId: "a" }, approvedRevision: { id: "revision", editionId: "edition", revisionNumber: 1 }, approvedRevisionId: "revision", approvals: [{ editionId: "edition", revisionId: "revision", approvedSendAt: new Date("2027-01-01"), revokedAt: null, recipientSelectionSnapshot: { mode: "ALL", workspaceId: "b" } }] }) } } },
    "@/lib/client-communications/email": { sendCampaignBatch: async () => { providerCalls++; } },
    "@/lib/newsletters/email-renderer": {}, "@/lib/newsletters/recipients": {},
    "@/lib/client-communications/preferences": {}, "@/lib/site": {}, "@/lib/newsletters/integrity": {},
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./delivery.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, console, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`);
    return modules[id];
  } });
  await assert.rejects(exports.deliverApprovedNewsletter!("edition", { kind: "ADMIN", actor: { workspaceId: "a", userId: "actor", sessionVersion: 1 } }), /Foreign approval/);
  assert.equal(providerCalls, 0);
});
