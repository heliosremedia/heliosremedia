import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as core from "./social/core.ts";
import * as grounding from "./social/grounding.ts";

type Row = Record<string, unknown>;
type Query = { where: Row; data: Row };
const copy = <T,>(value: T): T => structuredClone(value);
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND" || key === "OR") {
      assert.ok(Array.isArray(value));
      return key === "AND" ? value.every((clause) => matches(row, clause)) : value.some((clause) => matches(row, clause));
    }
    if (value && typeof value === "object") {
      if ("not" in value) { assert.deepEqual(Object.keys(value), ["not"]); return row[key] !== (value as Row).not; }
      return !!row[key] && typeof row[key] === "object" && matches(row[key] as Row, value as Row);
    }
    return row[key] === value;
  });
}
function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, Date, console, require: (id: string) => {
    assert.ok(id in modules, `Unadapted dependency: ${id}`); return modules[id];
  }, ...globals });
  return exports as T;
}

// Actual route, claim, source resolver, source readers, ownership scope, settings and grounding.
// Session/current-access, database transactions and output persistence are adapters.
// This does not simulate PostgreSQL locking or authorize any real provider call.
function harness(sourceType = "PROJECT", tenantMode = true, workspaceIds = ["a", "b"]) {
  const context = new AsyncLocalStorage<string>();
  const campaigns = ["a", "b"].map((workspaceId) => ({
    id: `campaign-${workspaceId}`, workspaceId, status: "DRAFT", generationStatus: null as string | null,
    generationRequestId: null as string | null, sourceType, sourceRecordIds: [`project-${workspaceId}`], sourceProjectId: null,
    verifiedSourceFacts: { title: "POISON_CACHED_FOREIGN_FACT" },
    variants: [{ id: `variant-${workspaceId}`, platform: "FACEBOOK", status: "DRAFT", contentVersion: 1, caption: "Before" }],
  }));
  const projects = ["a", "b"].map((workspaceId) => ({ id: `project-${workspaceId}`, workspaceId, title: `FACT_${workspaceId.toUpperCase()}`, details: null }));
  const contentSources = ["a", "b"].map((workspaceId) => ({
    id: `project-${workspaceId}`, workspaceId: workspaceId as string | null, title: `FACT_${workspaceId.toUpperCase()}`,
    subject: `FACT_${workspaceId.toUpperCase()}`, content: `BODY_${workspaceId.toUpperCase()}`,
    status: sourceType === "BLOG" ? "PUBLISHED" : "SENT", publishedAt: new Date("2026-01-01T00:00:00Z"),
    intendedSendAt: new Date("2026-01-01T00:00:00Z"), sentAt: new Date("2026-01-01T00:00:00Z"),
    series: { workspaceId: workspaceId as string | null, name: `SERIES_${workspaceId.toUpperCase()}` },
    blocks: [{ type: "TEXT", position: 0, content: `BODY_${workspaceId.toUpperCase()}` }],
  }));
  const calls: Array<{ workspaceId: string; body: Row }> = [];
  const writes: Array<{ workspaceId: string; variantId: string; data: Row }> = [];
  const allowed = new Set(["a", "b"]);
  let pause = false;
  let entered = () => {};
  let release = () => {};
  const waiting = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const delegates = {
    socialCampaign: {
      findFirst: async ({ where }: Query) => copy(campaigns.find((row) => matches(row, where)) || null),
      updateMany: async ({ where, data }: Query) => {
        const rows = campaigns.filter((row) => matches(row, where)); rows.forEach((row) => Object.assign(row, copy(data))); return { count: rows.length };
      },
      update: async ({ where, data }: Query) => {
        const row = campaigns.find((item) => matches(item, where)); assert.ok(row); Object.assign(row, copy(data)); return copy(row);
      },
    },
    project: { findFirst: async ({ where }: Query) => copy(projects.find((row) => matches(row, where)) || null) },
    blogPost: { findFirst: async ({ where }: Query) => copy(contentSources.find((row) => matches(row, where)) || null) },
    newsletterEdition: { findFirst: async ({ where }: Query) => copy(contentSources.find((row) => matches(row, where)) || null) },
    workspace: { findMany: async () => workspaceIds.map((id) => ({ id })), findUniqueOrThrow: async ({ where }: Query) => ({ name: `COMPANY_${String(where.id).toUpperCase()}` }) },
    socialStudioSettings: { upsert: async ({ where }: Query) => ({ brandVoice: `VOICE_${String(where.workspaceId).toUpperCase()}`, writingGuardrails: "Only supplied facts", primaryAudience: "Agents" }) },
  };
  const db = { ...delegates, $transaction: async <T,>(fn: (tx: typeof delegates) => Promise<T>): Promise<T> => fn(delegates) };
  const access = { requireLockedWorkspaceEditor: async (_tx: unknown, actor: { workspaceId: string }) => {
    if (!allowed.has(actor.workspaceId)) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
  } };
  const tenantContext = { tenantContextEnabled: () => tenantMode };
  const ownership = load<typeof import("./blog-ownership")>("./blog-ownership.ts", {
    "server-only": {}, "@/lib/prisma": { prisma: db }, "@/lib/workspace-context-core": tenantContext,
  });
  const studio = load<typeof import("./social/studio")>("./social/studio.ts", {
    "@/lib/prisma": { prisma: db }, "./core": core, "./mutation-lock": {}, "@/app/generated/prisma/client": {},
    "@/lib/workspace-context-core": tenantContext, "@/lib/workspace-write-access": access, "@/lib/blog-ownership": ownership,
  });
  const source = load<typeof import("./social/source-context")>("./social/source-context.ts", {
    "server-only": {}, "@/lib/prisma": { prisma: db }, "./studio": studio,
  });
  const claim = load<typeof import("./social/generation-ownership")>("./social/generation-ownership.ts", {
    "./source-context": source, "@/lib/prisma": { prisma: db }, "@/lib/workspace-write-access": access,
  });
  const route = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/social/ai/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/prisma": { prisma: db },
    "@/lib/auth/session": { getAdminSession: async () => ({ workspaceId: context.getStore(), userId: `actor-${context.getStore()}`, role: "EDITOR", sessionVersion: 1 }) },
    "@/lib/social/core": core, "@/lib/social/grounding": grounding, "@/lib/social/generation-ownership": claim,
    "@/lib/workspace-write-access": access, "@/lib/social/studio": {
      ...studio, updateVariantContent: async (input: { workspaceId: string; variantId: string; data: Row }, tx: unknown) => {
        assert.equal(tx, delegates); writes.push(copy(input));
      },
    },
  }, {
    DOMException, AbortSignal: { timeout: () => undefined }, process: { env: { OPENAI_API_KEY: "synthetic-unused" } },
    fetch: async (url: string, options: { body: string }) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const workspaceId = context.getStore()!; const body = JSON.parse(options.body);
      calls.push({ workspaceId, body });
      if (pause && workspaceId === "a" && body.text.format.type === "json_object") { entered(); await gate; }
      const marker = workspaceId.toUpperCase();
      const campaignBrief = { positioning: `DRAFT_${marker}`, themes: ["Photography"], cadence: "Weekly", formats: ["Post"], platformConsiderations: "Clear", callsToAction: "Explore" };
      const draft = { caption: `DRAFT_${marker}`, openingHook: "", hashtags: [], callToAction: "", onScreenText: "", videoConcept: "", altText: "" };
      return Response.json({ output_text: JSON.stringify(body.text.format.type === "json_object"
        ? { campaignBrief, FACEBOOK: draft } : { campaignBrief, platforms: { FACEBOOK: draft }, unsupportedClaims: [] }) });
    },
  });
  return { campaigns, contentSources, calls, writes, allowed, waiting, release, pause: () => { pause = true; },
    call: (actor: string, campaign = `campaign-${actor}`, extra: Row = {}) => context.run(actor, () => route.POST(new Request("https://synthetic.test/api/admin/social/ai", {
      method: "POST", body: JSON.stringify({ campaignId: campaign, requestId: "same-request-id", workspaceId: actor === "a" ? "b" : "a", ...extra }),
    }))),
  };
}

for (const actor of ["a", "b"]) test(`Social AI ${actor} rejects foreign campaign, variant and source before provider or mutation`, async () => {
  const h = harness(); const foreign = actor === "a" ? "b" : "a";
  const before = JSON.stringify(h.campaigns);
  assert.equal((await h.call(actor, `campaign-${foreign}`)).status, 404);
  assert.equal((await h.call(actor, undefined, { variantId: `variant-${foreign}` })).status, 404);
  assert.equal(JSON.stringify(h.campaigns), before);
  h.campaigns.find((row) => row.workspaceId === actor)!.sourceRecordIds = [`project-${foreign}`];
  const corrupt = JSON.stringify(h.campaigns);
  assert.equal((await h.call(actor)).status, 409);
  assert.equal(JSON.stringify(h.campaigns), corrupt);
  assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
});

for (const sourceType of ["PROJECT", "BLOG", "NEWSLETTER"]) test(`overlapping Social AI ${sourceType} requests isolate fresh source facts, company voice and output targets`, { timeout: 5000 }, async () => {
  const h = harness(sourceType); h.pause();
  const pendingA = h.call("a"); await h.waiting;
  assert.equal((await h.call("b")).status, 200); assert.equal(h.writes.length, 1); assert.equal(h.writes[0].workspaceId, "b");
  h.release(); assert.equal((await pendingA).status, 200);
  assert.equal(h.calls.length, 4); assert.equal(h.writes.length, 2);
  for (const actor of ["a", "b"]) {
    const own = actor.toUpperCase(); const foreign = actor === "a" ? "B" : "A";
    const calls = h.calls.filter((call) => call.workspaceId === actor);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.match(String(call.body.input), new RegExp(`FACT_${own}`));
      if (sourceType !== "PROJECT") assert.match(String(call.body.input), new RegExp(`BODY_${own}`));
      if (sourceType === "NEWSLETTER") assert.match(String(call.body.input), new RegExp(`SERIES_${own}`));
      assert.doesNotMatch(JSON.stringify(call.body), new RegExp(`FACT_${foreign}|VOICE_${foreign}|COMPANY_${foreign}|DRAFT_${foreign}|BODY_${foreign}|SERIES_${foreign}|POISON_CACHED`));
    }
    assert.match(String(calls[0].body.instructions), new RegExp(`COMPANY_${own}.*VOICE_${own}`));
    const write = h.writes.find((item) => item.workspaceId === actor)!;
    assert.equal(write.variantId, `variant-${actor}`); assert.equal(write.data.caption, `DRAFT_${own}`);
    const campaign = h.campaigns.find((item) => item.workspaceId === actor)!;
    assert.equal(campaign.generationStatus, "SUCCEEDED"); assert.match(JSON.stringify(campaign.verifiedSourceFacts), new RegExp(`FACT_${own}`));
    assert.equal((await h.call(actor)).status, 200);
  }
  assert.equal(h.calls.length, 4); assert.equal(h.writes.length, 2);
});

test("revocation while Social AI is pending prevents output settlement without affecting the other tenant", { timeout: 5000 }, async () => {
  const h = harness(); h.pause(); const pending = h.call("a"); await h.waiting;
  h.allowed.delete("a"); assert.equal((await h.call("b")).status, 200); h.release();
  assert.equal((await pending).status, 403);
  assert.deepEqual(h.writes.map((item) => item.workspaceId), ["b"]);
  assert.equal(h.campaigns[0].generationStatus, "FAILED"); assert.equal(h.campaigns[1].generationStatus, "SUCCEEDED");
});

for (const sourceType of ["BLOG", "NEWSLETTER"]) {
  for (const actor of ["a", "b"]) test(`Social AI ${sourceType} ${actor} rejects foreign, unpublished, missing and unowned content`, async () => {
    const foreign = actor === "a" ? "b" : "a";
    for (const invalid of ["foreign", "unpublished", "missing", "unowned"]) {
      const h = harness(sourceType);
      const campaign = h.campaigns.find((row) => row.workspaceId === actor)!;
      const source = h.contentSources.find((row) => row.workspaceId === actor)!;
      if (invalid === "foreign") campaign.sourceRecordIds = [`project-${foreign}`];
      if (invalid === "missing") campaign.sourceRecordIds = ["missing"];
      if (invalid === "unpublished") source.status = "DRAFT";
      if (invalid === "unowned") { source.workspaceId = null; source.series.workspaceId = null; }
      const before = JSON.stringify(h.campaigns);
      assert.equal((await h.call(actor)).status, 409, invalid);
      assert.equal(JSON.stringify(h.campaigns), before, invalid);
      assert.equal(h.calls.length, 0, invalid); assert.equal(h.writes.length, 0, invalid);
    }
  });

  test(`Social AI ${sourceType} legacy content requires the sole matching workspace and disabled tenant mode`, async () => {
    for (const [tenantMode, workspaceIds, expected] of [
      [false, ["a"], 200], [true, ["a"], 409], [false, ["a", "b"], 409], [false, ["b"], 409], [false, [], 409],
    ] as const) {
      const h = harness(sourceType, tenantMode, [...workspaceIds]);
      h.contentSources[0].workspaceId = null; h.contentSources[0].series.workspaceId = null;
      const before = JSON.stringify(h.campaigns);
      assert.equal((await h.call("a")).status, expected);
      if (expected === 200) {
        assert.equal(h.calls.length, 2); assert.equal(h.writes.length, 1);
        assert.equal(h.writes[0].workspaceId, "a");
        for (const call of h.calls) {
          assert.match(String(call.body.input), /FACT_A/);
          assert.doesNotMatch(JSON.stringify(call.body), /FACT_B|BODY_B|SERIES_B|POISON_CACHED/);
        }
      } else {
        assert.equal(JSON.stringify(h.campaigns), before); assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
      }
    }
  });
}
