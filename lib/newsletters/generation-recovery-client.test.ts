import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const exports: { requestGenerationRecovery?: (id: string, action: unknown, signal: AbortSignal | undefined, transport: typeof fetch) => Promise<unknown> } = {};
runInNewContext(ts.transpileModule(readFileSync(new URL("../../app/admin/newsletter-studio/components/generation-recovery-client.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error });
const request = exports.requestGenerationRecovery!;
const review = { editionId: "edition/a", rowVersion: 6, editionStatus: "GENERATING", runId: "run", eligible: true, automaticRetryAllowed: false };

test("generation recovery client binds the reviewed edition, version and run without company or execution credentials", async () => {
  const signal = new AbortController().signal;
  const transport: typeof fetch = async (url, options) => {
    assert.equal(url, "/api/admin/newsletters/editions/edition%2Fa/generation-recovery");
    assert.equal(options?.cache, "no-store"); assert.equal(options?.signal, signal);
    if (options?.method === "POST") assert.deepEqual(JSON.parse(String(options.body)), { confirmation: "RETURN_EXPIRED_GENERATION_TO_REVIEW", expectedVersion: 6, runId: "run" });
    else assert.equal(options?.body, undefined);
    return Response.json({ success: true, review });
  };
  assert.deepEqual(await request("edition/a", undefined, signal, transport), review);
  assert.equal(await request("edition/a", { expectedVersion: 6, runId: "run", workspaceId: "foreign" }, signal, transport), null);
});

test("generation recovery client rejects malformed or mismatched evidence and bounds access and stale errors", async () => {
  for (const patch of [{ editionId: "foreign" }, { rowVersion: -1 }, { rowVersion: 1.2 }, { eligible: "true" }, { runId: null }, { runId: "" }, { editionStatus: "SENT" }, { automaticRetryAllowed: true }]) {
    await assert.rejects(request("edition/a", undefined, undefined, async () => Response.json({ success: true, review: { ...review, ...patch } })), /fresh review/);
  }
  for (const status of [403, 409, 500]) {
    await assert.rejects(request("edition/a", undefined, undefined, async () => new Response("private internal error", { status })), status === 403 ? /Administrator access/ : /fresh review/);
  }
  const blocked = { ...review, eligible: false, runId: null, editionStatus: "NEEDS_REVIEW" };
  assert.deepEqual(await request("edition/a", undefined, undefined, async () => Response.json({ success: true, review: blocked })), blocked);
});
