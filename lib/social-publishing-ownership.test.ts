import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as core from "./social/core.ts";
import * as publishingCore from "./social/publishing-core.ts";

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, URL, Date, console, ...globals,
  });
  return exports as T;
}
const payloadPolicy = load<typeof import("./social/publishing-payload")>("./social/publishing-payload.ts", { "./core": core });
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const now = new Date("2026-09-11T12:00:00.000Z");

test("publishing payload normalization preserves old digests despite JSONB key order", () => {
  const original = { platform: "FACEBOOK", postType: "IMAGE_POST", caption: "Copy", hashtags: ["photo"], destinationLink: undefined, media: [{ url: "https://assets.example.test/image.webp", mimeType: "image/webp", altText: "Photo" }] };
  const reordered = { media: [{ altText: "Photo", mimeType: "image/webp", url: "https://assets.example.test/image.webp" }], hashtags: ["photo"], caption: "Copy", postType: "IMAGE_POST", platform: "FACEBOOK" };
  assert.notEqual(digest(original), digest(reordered));
  assert.equal(digest(payloadPolicy.normalizePublishingPayload(reordered)), digest(original));
  assert.equal(payloadPolicy.normalizePublishingPayload({ ...reordered, platform: "FOREIGN" }), null);
  assert.equal(payloadPolicy.publishingStorageReferenceMatches("a", "project", "projects/foreign/image.webp"), false);
  assert.equal(payloadPolicy.publishingStorageReferenceMatches("a", "project", "workspaces/b/image.webp"), false);
  assert.equal(payloadPolicy.publishingStorageReferenceMatches("a", "project", "projects/project/../../foreign/image.webp"), false);
});

function workerHarness() {
  const counters = { decrypts: 0, publications: 0, connections: 0, completions: 0 };
  const control = { reserve: true };
  const variant = {
    id: "variant", campaignId: "campaign", platform: "FACEBOOK", postType: "TEXT_POST", caption: "Approved copy", hashtags: [] as string[], destinationLink: null as string | null,
    contentVersion: 3, approvedAt: now as Date | null, approvalActorId: "actor" as string | null, scheduledAt: now as Date | null, status: "SCHEDULED",
    campaign: { workspaceId: "a", status: "APPROVED", autopilotDraft: null as null | { rejectedAt: Date | null; week: { workspaceId: string } } },
    media: [] as Array<{ altText: string | null; media: { projectId: string; project: { workspaceId: string }; visibility: string; storageKey: string | null; externalUrl: string | null; mimeType: string | null } }>,
  };
  const payload = { platform: "FACEBOOK", postType: "TEXT_POST", caption: "Approved copy", hashtags: [], media: [] };
  const snapshot = { id: "snapshot", variantId: "variant", connectionId: "connection", contentVersion: 3, contentDigest: digest(payload), payload: Object.fromEntries(Object.entries(payload).reverse()), approvedById: "actor", approvedAt: now, scheduledAt: now, invalidatedAt: null as Date | null };
  const connection = { id: "connection", workspaceId: "a", platform: "FACEBOOK", state: "CONNECTED", directPublishingEnabled: true, tokenExpiresAt: null as Date | null, encryptedTokenPayload: "fake-cipher", providerAccountId: "test-destination" };
  const job = { id: "job", variantId: "variant", connectionId: "connection", snapshotId: "snapshot", variant, snapshot, connection, idempotencyKey: publishingCore.publishingIdempotencyKey("variant", "connection", 3, now), scheduledAt: now, nextAttemptAt: now, attempts: 0, maxAttempts: 5, status: "SCHEDULED", claimToken: null as string | null };
  const env = { SOCIAL_FACEBOOK_PUBLISHING_ENABLED: "true" };
  const tx = {
    $queryRaw: async () => [{ id: "locked" }],
    socialPublishingJob: {
      findFirst: async ({ where }: { where: { status: string; variant: { campaign: { workspaceId: string } } } }) => { assert.equal(where.status, "VALIDATING"); assert.equal(where.variant.campaign.workspaceId, "a"); return { ...job }; },
      updateMany: async ({ where, data }: { where: { claimToken: string; status: string }; data: Record<string, unknown> }) => { assert.equal(where.claimToken, "claim"); assert.equal(where.status, "VALIDATING"); if (data.status === "PUBLISHING" && !control.reserve) return { count: 0 }; Object.assign(job, data); return { count: 1 }; },
    },
  };
  const prisma = {
    socialPublishingJob: {
      findMany: async () => [{ id: "job" }],
      updateMany: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(job, data); return { count: 1 }; },
      findFirst: async () => ({ variant: { campaign: { workspaceId: "a" } } }),
      update: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(job, data); return job; },
    },
    socialConnection: { update: async () => { counters.connections++; return {}; } },
    socialPublishingAttempt: { create: async () => ({}) },
    socialVariant: { update: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(variant, data); counters.completions++; return variant; } },
    socialPublication: { create: async () => ({}) },
    $transaction: (operation: ((client: typeof tx) => Promise<unknown>) | Array<Promise<unknown>>) => typeof operation === "function" ? operation(tx) : Promise.all(operation),
  };
  const api = load<typeof import("./social/publishing")>("./social/publishing.ts", {
    "server-only": {}, "node:crypto": { randomUUID: () => "claim" }, "@/app/generated/prisma/client": {}, "@/lib/prisma": { prisma },
    "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.example.test/${key}` },
    "@/lib/workspace-write-access": {}, "./mutation-lock": {}, "./publishing-payload": payloadPolicy,
    "./security": { contentDigest: digest, decryptSocialToken: () => { counters.decrypts++; return { accessToken: "fake-access" }; } },
    "./publishing-core": publishingCore,
    "./providers": { normalizeProviderError: () => ({ category: "UNKNOWN", message: "Test failure", retryable: false, ambiguous: false }), providerAdapters: { FACEBOOK: {
      validatePost: () => [], publish: async (value: unknown, token: string, destination: string, key: string) => {
        assert.equal(job.status, "PUBLISHING"); assert.equal(digest(value), snapshot.contentDigest); assert.equal(token, "fake-access"); assert.equal(destination, "test-destination"); assert.equal(key, job.idempotencyKey); counters.publications++;
        return { outcome: "PUBLISHED", externalPostId: "fake-post", publicUrl: "https://example.test/fake-post" };
      },
    } } },
  }, { process: { env } });
  return { api, counters, job, variant, snapshot, connection, env, control };
}

test("publishing rejects foreign or stale snapshots before decryption or provider access", async () => {
  const cases: Array<(h: ReturnType<typeof workerHarness>) => void> = [
    (h) => { h.connection.workspaceId = "b"; },
    (h) => { h.snapshot.variantId = "foreign"; },
    (h) => { h.snapshot.connectionId = "foreign"; },
    (h) => { h.snapshot.invalidatedAt = now; },
    (h) => { h.variant.contentVersion = 4; },
    (h) => { h.variant.scheduledAt = new Date(now.getTime() + 1000); },
    (h) => { h.job.idempotencyKey = "foreign-key"; },
    (h) => { h.variant.approvedAt = null; },
    (h) => { h.variant.status = "CHANGES_REQUESTED"; },
    (h) => { h.variant.caption = "Unapproved edit"; },
    (h) => { h.snapshot.payload.caption = "Tampered snapshot"; },
    (h) => { h.variant.campaign.status = "ARCHIVED"; },
    (h) => { h.variant.campaign.autopilotDraft = { rejectedAt: now, week: { workspaceId: "a" } }; },
    (h) => { h.variant.media = [{ altText: null, media: { projectId: "foreign", project: { workspaceId: "b" }, visibility: "VISIBLE", storageKey: "projects/foreign/image.webp", externalUrl: null, mimeType: "image/webp" } }]; },
  ];
  for (const mutate of cases) {
    const h = workerHarness(); mutate(h); await h.api.processPublishingQueue(now);
    assert.equal(h.job.status, "CANCELLED"); assert.equal(h.counters.decrypts, 0); assert.equal(h.counters.publications, 0); assert.equal(h.counters.connections, 0);
  }
});

test("publishing holds disabled destinations and expired tokens without provider calls", async () => {
  for (const mode of ["flag", "destination", "expiry"]) {
    const h = workerHarness();
    if (mode === "flag") h.env.SOCIAL_FACEBOOK_PUBLISHING_ENABLED = "false";
    if (mode === "destination") h.connection.directPublishingEnabled = false;
    if (mode === "expiry") h.connection.tokenExpiresAt = new Date(now.getTime() - 1);
    await h.api.processPublishingQueue(now);
    assert.equal(h.job.status, mode === "expiry" ? "REAUTHORIZATION_REQUIRED" : "DELAYED"); assert.equal(h.job.claimToken, null);
    assert.equal(h.counters.decrypts, 0); assert.equal(h.counters.publications, 0); assert.equal(h.counters.connections, 0);
  }
});

test("valid legacy publishing preserves payload, destination, idempotency and completion behavior", async () => {
  const h = workerHarness(); await h.api.processPublishingQueue(now);
  assert.equal(h.counters.decrypts, 1); assert.equal(h.counters.publications, 1); assert.equal(h.counters.completions, 1); assert.equal(h.job.status, "PUBLISHED"); assert.equal(h.variant.status, "PUBLISHED");
});

test("queue creation reads approval inside the authorized transaction and rejects invalidated snapshots", async () => {
  let authorized = false;
  let invalidated = true;
  let jobs = 0;
  const payload = { platform: "FACEBOOK", postType: "TEXT_POST", caption: "Copy", hashtags: [], media: [] };
  const variant = { id: "variant", campaignId: "campaign", campaign: { workspaceId: "a" }, platform: "FACEBOOK", postType: "TEXT_POST", caption: "Copy", hashtags: [], destinationLink: null, media: [], approvedAt: now, approvalActorId: "actor", scheduledAt: now, status: "APPROVED", contentVersion: 3 };
  const tx = {
    socialVariant: { findFirstOrThrow: async ({ where }: { where: { campaign: { workspaceId: string } } }) => { assert.equal(authorized, true); assert.equal(where.campaign.workspaceId, "a"); return variant; } },
    socialConnection: { findFirstOrThrow: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return { id: "connection", workspaceId: "a", platform: "FACEBOOK", directPublishingEnabled: true, state: "CONNECTED", tokenExpiresAt: null }; } },
    socialPublishingSnapshot: { upsert: async () => ({ id: "snapshot", invalidatedAt: invalidated ? now : null, contentDigest: digest(payload), approvedById: "actor", approvedAt: now }) },
    socialPublishingJob: { upsert: async ({ create }: { create: Record<string, unknown> }) => { jobs++; return { ...create, status: "SCHEDULED" }; } },
  };
  const api = load<typeof import("./social/publishing")>("./social/publishing.ts", {
    "server-only": {}, "node:crypto": {}, "@/app/generated/prisma/client": {}, "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
    "@/lib/r2-upload": {}, "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { authorized = true; } }, "./mutation-lock": { lockEditableSocialVariant: async () => { assert.equal(authorized, true); } }, "./publishing-payload": payloadPolicy,
    "./security": { contentDigest: digest }, "./publishing-core": publishingCore, "./providers": { providerAdapters: { FACEBOOK: { validatePost: () => [] } } },
  }, { process: { env: { SOCIAL_FACEBOOK_PUBLISHING_ENABLED: "true" } } });
  const input = { variantId: "variant", connectionId: "connection", actor: { userId: "actor", workspaceId: "a", sessionVersion: 1 } };
  await assert.rejects(api.createPublishingJob(input), /new approved revision/); assert.equal(jobs, 0);
  invalidated = false; await api.createPublishingJob(input); assert.equal(jobs, 1);
});

test("publishing job administration rejects in-flight jobs, foreign records and stale roles", async () => {
  let role = "ADMIN";
  let status = "SCHEDULED";
  let claimToken: string | null = null;
  let found = true;
  let changed = 1;
  let writes = 0;
  const tx = {
    $queryRaw: async () => [],
    socialPublishingJob: {
      findFirst: async ({ where }: { where: { connection: { workspaceId: string }; variant: { campaign: { workspaceId: string } } } }) => {
        assert.equal(where.connection.workspaceId, "a"); assert.equal(where.variant.campaign.workspaceId, "a");
        return found ? { id: "job", status, claimToken } : null;
      },
      updateMany: async ({ where }: { where: { status: string; claimToken: null; connection: { workspaceId: string }; variant: { campaign: { workspaceId: string } } } }) => {
        assert.equal(where.status, status); assert.equal(where.claimToken, null); assert.equal(where.connection.workspaceId, "a"); assert.equal(where.variant.campaign.workspaceId, "a"); writes++; return { count: changed };
      },
    },
  };
  const api = load<{ PATCH: (request: Request) => Promise<Response> }>("../app/api/admin/social/publishing-jobs/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "ADMIN", workspaceId: "a" }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => ({ role }) },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const call = (action = "cancel") => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ jobId: "job", action, workspaceId: "b" }) }));
  for (const state of ["VALIDATING", "PUBLISHING", "PROVIDER_PROCESSING", "PUBLISHED"]) { status = state; assert.equal((await call()).status, 409); }
  status = "SCHEDULED"; claimToken = "claim"; assert.equal((await call()).status, 409);
  claimToken = null; found = false; assert.equal((await call()).status, 404);
  found = true; role = "EDITOR"; assert.equal((await call()).status, 403); assert.equal(writes, 0);
  role = "ADMIN"; changed = 0; assert.equal((await call()).status, 409);
  changed = 1; assert.equal((await call()).status, 200);
  status = "FAILED"; assert.equal((await call("retry")).status, 200);
});

test("campaign archival takes the publishing mutation guard before changing campaign state", async () => {
  let executing = true;
  let writes = 0;
  const tx = {
    socialVariant: { findMany: async ({ where }: { where: { campaign: { workspaceId: string } } }) => { assert.equal(where.campaign.workspaceId, "a"); return [{ id: "variant" }]; } },
    socialCampaign: { updateMany: async () => { writes++; return { count: 1 }; } },
  };
  const api = load<{ PATCH: (request: Request, context: { params: Promise<{ campaignId: string }> }) => Promise<Response> }>("../app/api/admin/social/campaigns/[campaignId]/route.ts", {
    "@/lib/social/mutation-lock": { lockEditableSocialVariant: async (_tx: unknown, id: string, workspaceId: string) => { assert.equal(id, "variant"); assert.equal(workspaceId, "a"); if (executing) throw new Error("SOCIAL_PUBLICATION_IN_PROGRESS"); } },
    "next/server": { NextResponse: Response }, "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => ({ role: "EDITOR" }) },
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a", userId: "actor", sessionVersion: 1 }) },
    "@/lib/social/core": core, "@/lib/client-communications/scheduling": {}, "@/lib/social/publishing": {}, "@/lib/social/studio": {},
    "@/lib/prisma": { prisma: { socialVariant: { findFirst: async () => null }, $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const call = () => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ action: "archive-campaign" }) }), { params: Promise.resolve({ campaignId: "campaign" }) });
  assert.equal((await call()).status, 409); assert.equal(writes, 0);
  executing = false; assert.equal((await call()).status, 200); assert.equal(writes, 1);
});


test("a lost publication reservation cannot reach token decryption or the provider", async () => {
  const h = workerHarness(); h.control.reserve = false;
  await h.api.processPublishingQueue(now);
  assert.equal(h.counters.decrypts, 0); assert.equal(h.counters.publications, 0); assert.equal(h.counters.completions, 0);
});
