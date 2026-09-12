import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function harness(options: { duration?: number; enqueueDuration?: number; claimDuration?: number; jobs?: number; fail?: boolean; type?: "GENERATE" | "SEND" | "NOTIFY"; settlement?: "CLAIM_CHANGED" | "UNAVAILABLE"; paused?: boolean } = {}) {
  let clock = 0, claims = 0, active = false, finished = 0, enqueues = 0;
  const notifications: string[] = [];
  const terminalWrite = async () => {
    active = false; finished++;
    if (options.settlement === "UNAVAILABLE") throw new Error("Synthetic database outage");
    return options.settlement !== "CLAIM_CHANGED";
  };
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: Response },
    "@/lib/prisma": { prisma: { newsletterEdition: { findUnique: async () => ({ id: "edition", subject: "Synthetic", series: { name: "Series", status: "ACTIVE" } }) } } },
    "@/lib/site": { getSiteUrl: () => "https://synthetic.invalid" },
    "@/lib/newsletters/delivery": { deliverApprovedNewsletter: async () => { assert.equal(options.type, "SEND"); return { sent: 3, failed: 0 }; } },
    "@/lib/newsletters/generation": { generateNewsletterEdition: async (_id: string, actor: { kind: string; jobId: string; claimToken: string }) => {
      assert.equal(actor.kind, "BACKGROUND"); assert.equal(actor.jobId, `job-${claims}`); assert.equal(actor.claimToken, `token-${claims}`);
      clock += options.duration ?? 0; if (options.fail) throw new Error("Synthetic failure");
    } },
    "@/lib/newsletters/notification-context": { notifyNewsletterEdition: async (input: { editionId: string; kind: string }) => { assert.equal(input.editionId, "edition"); notifications.push(input.kind); return { delivered: false }; } },
    "@/lib/newsletters/missed-approval": { markNewsletterApprovalMissed: async () => { throw new Error("Unexpected approval mutation"); } },
    "@/lib/newsletters/presentation": { shouldExecuteNewsletterJob: () => !options.paused },
    "@/lib/newsletters/scheduler": {
      enqueueDueNewsletterJobs: async () => { enqueues++; clock += options.enqueueDuration ?? 0; return {}; },
      claimDueNewsletterJobs: async (input: { limit: number; leaseSeconds: number }) => {
        assert.equal(active, false, "must settle the current job before claiming another");
        assert.equal(input.limit, 1); assert.equal(input.leaseSeconds, 300); claims++;
        clock += options.claimDuration ?? 0;
        if (claims > (options.jobs ?? 20)) return [];
        active = true; return [{ id: `job-${claims}`, editionId: "edition", type: options.type ?? "GENERATE", claimToken: `token-${claims}` }];
      },
      completeNewsletterJob: terminalWrite,
      failNewsletterJob: terminalWrite,
      deferUnstartedNewsletterJob: terminalWrite,
    },
  };
  const settlement = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('./job-settlement.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: settlement, Error, require: (id: string) => {
      if (id === 'server-only') return {};
      assert.equal(id, './scheduler'); return modules['@/lib/newsletters/scheduler'];
    },
  });
  modules['@/lib/newsletters/job-settlement'] = settlement;
  const exports: { GET?: (request: Request) => Promise<Response> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL("../../app/api/cron/newsletters/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, Date, performance: { now: () => clock }, process: { env: { CRON_SECRET: "synthetic-secret" } },
    require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return { call: (authorized = true) => exports.GET!(new Request("https://synthetic.invalid", { headers: authorized ? { Authorization: "Bearer synthetic-secret" } : {} })), notifications, stats: () => ({ claims, finished, enqueues }) };
}

test("worker claims one job at a time, stops at its cap and leaves later work unclaimed", async () => {
  const h = harness(); const result = await (await h.call()).json();
  assert.equal(result.claimed, 10); assert.equal(result.results.length, 10); assert.deepEqual(h.stats(), { claims: 10, finished: 10, enqueues: 1 });
});

test("worker admission window includes enqueue time and stops after slow success or failure", async () => {
  for (const fail of [false, true]) {
    const h = harness({ duration: 30_000, fail }); const result = await (await h.call()).json();
    assert.equal(result.claimed, 1); assert.equal(result.results[0].success, !fail); assert.equal(h.stats().claims, 1);
  }
  const spent = harness({ enqueueDuration: 30_000 }); assert.equal((await (await spent.call()).json()).claimed, 0); assert.equal(spent.stats().claims, 0);
});

test("worker exits on an empty queue and unauthorized requests have no scheduling effects", async () => {
  const empty = harness({ jobs: 0 }); assert.equal((await (await empty.call()).json()).claimed, 0); assert.equal(empty.stats().claims, 1);
  const denied = harness(); assert.equal((await denied.call(false)).status, 401); assert.deepEqual(denied.stats(), { claims: 0, finished: 0, enqueues: 0 });
});


test("an unavailable administrator notification does not reclassify completed delivery as a failed send", async () => {
  const h = harness({ type: "SEND", jobs: 1 });
  const result = await (await h.call()).json();
  assert.equal(result.results.length, 1); assert.equal(result.results[0].success, true);
  assert.deepEqual(h.notifications, ["SEND_COMPLETED"]); assert.equal(h.stats().finished, 1);
});

test("an unsupported job is not reported as successfully executed", async () => {
  const h = harness({ type: "NOTIFY", jobs: 1 });
  const result = await (await h.call()).json();
  assert.equal(result.results.length, 1); assert.equal(result.results[0].success, false);
  assert.deepEqual(h.notifications, []); assert.equal(h.stats().finished, 1);
});

test("uncertain or changed settlement preserves execution evidence and stops further claims", async () => {
  for (const settlement of ["CLAIM_CHANGED", "UNAVAILABLE"] as const) {
    for (const fail of [false, true]) {
      const h = harness({ settlement, fail });
      const result = await (await h.call()).json();
      assert.equal(result.claimed, 1); assert.equal(h.stats().claims, 1);
      assert.equal(result.results[0].success, false);
      assert.equal(result.results[0].execution, fail ? "FAILED" : "SUCCEEDED");
      assert.equal(result.results[0].settlement, settlement);
    }
  }
});

test("a paused series is explicitly skipped and still requires confirmed settlement", async () => {
  const h = harness({ paused: true, jobs: 1 });
  const result = await (await h.call()).json();
  assert.equal(result.results[0].execution, "SKIPPED");
  assert.equal(result.results[0].settlement, "COMPLETED");
  assert.equal(result.results[0].success, true); assert.deepEqual(h.notifications, []);
});

test("a slow claim is deferred before domain execution and never causes another claim", async () => {
  for (const settlement of [undefined, 'CLAIM_CHANGED', 'UNAVAILABLE'] as const) {
    const h = harness({ claimDuration: 30_000, settlement });
    const result = await (await h.call()).json();
    assert.equal(result.claimed, 1); assert.equal(h.stats().claims, 1);
    assert.equal(result.results[0].execution, 'DEFERRED');
    assert.equal(result.results[0].settlement, settlement ?? 'DEFERRED');
    assert.equal(result.results[0].success, false); assert.deepEqual(h.notifications, []);
  }
});
