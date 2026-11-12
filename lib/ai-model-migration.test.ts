/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const writers = ["lib/events/ai.ts", "lib/newsletters/ai.ts", "lib/newsletters/generation.ts", "lib/referrals/ai.ts", "lib/social/autopilot.ts", "lib/blog-series.ts", "app/api/admin/blog/ai/route.ts", "app/api/admin/blog/series/assistant/route.ts", "app/api/admin/email-ai/route.ts", "app/api/admin/locations/ai/route.ts", "app/api/admin/social/ai/route.ts"];
test("all writing paths use budget-compatible defaults and retain configured precedence", () => {
  for (const path of writers) {
    const source = read(path);
    assert.match(source, /process\.env\.OPENAI_\w+_MODEL/, path);
    assert.match(source, /\|\| "gpt-6-luna"/, path);
    assert.doesNotMatch(source, /gpt-5\.6-terra/);
  }
  assert.match(read("app/api/admin/locations/ai/route.ts"), /const attemptModels = \[\.\.\.models, "gpt-6-luna"\]/);
  assert.match(read("app/api/admin/social/ai/route.ts"), /groundingModel === "gpt-6-luna" \? \{ reasoning: \{ effort: "none" \} \} : \{\}/);
});
test("runtime sources contain no retired default or fallback model literals", () => {
  function check(directory: string) {
    for (const entry of readdirSync(new URL(directory, root), { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) check(path);
      else if (/\.tsx?$/.test(path) && !path.endsWith(".test.ts")) assert.doesNotMatch(read(path), /gpt-5-mini|gpt-4\.1-mini|gpt-image-1\.5|gpt-3\.5-turbo/, path);
    }
  }
  check("app"); check("lib");
});
function imageSetup(env: Record<string, string> = {}, rejected = false) {
  const calls: any[] = [], uploads: any[] = [], records: any[] = [];
  const exports: any = {};
  const imports: Record<string, unknown> = {
    "server-only": {},
    "@aws-sdk/client-s3": { PutObjectCommand: class { input: unknown; constructor(input: unknown) { this.input = input; } }, DeleteObjectCommand: class {} },
    "@/lib/prisma": { prisma: { newsletterImageAsset: { create: async ({ data }: any) => { records.push(data); return { id: "asset-1", ...data }; } } } },
    "@/lib/r2": { r2Client: { send: async (command: any) => { uploads.push(command.input); } }, r2Config: { bucketName: "test-bucket" } },
    "@/lib/r2-upload": { createNewsletterAiImageKey: () => "test.webp", getPublicAssetUrl: () => "https://example.invalid/test.webp" },
  };
  const js = ts.transpileModule(read("lib/newsletters/image-assets.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: (name: string) => { assert.ok(name in imports, name); return imports[name]; }, process: { env: { OPENAI_API_KEY: "test-only", ...env } }, Buffer, AbortSignal, console: { error: () => {} }, fetch: async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json(rejected ? { error: { code: "model_not_found" } } : { data: [{ b64_json: Buffer.from("test-image-bytes").toString("base64") }] }, { status: rejected ? 404 : 200 });
  } });
  return { api: exports, calls, uploads, records };
}
const imageInput = { prompt: "A calm editorial interior", altText: "Soft light in an interior", actorId: "test-user" };
test("shared images retain format, dimensions and one-image limit with truthful attribution", async () => {
  const { api, calls, uploads, records } = imageSetup();
  await api.generateNewsletterImage(imageInput);
  const request = calls[0].body;
  assert.equal(request.model, "gpt-image-2.6-flare"); assert.equal(request.size, "1536x1024"); assert.equal(request.quality, "medium"); assert.equal(request.output_format, "webp"); assert.equal(request.output_compression, 88); assert.equal(request.n, 1); assert.equal(request.response_format, undefined);
  assert.equal(uploads.length, 1); assert.equal(records.length, 1); assert.equal(records[0].model, request.model); assert.equal(records[0].attribution, `AI-generated with OpenAI ${request.model}`);
});
test("image override matches persisted model and attribution", async () => {
  const { api, calls, records } = imageSetup({ OPENAI_IMAGE_MODEL: " gpt-image-2.6-sunburst " });
  await api.generateNewsletterImage(imageInput);
  assert.equal(calls[0].body.model, "gpt-image-2.6-sunburst"); assert.equal(records[0].model, calls[0].body.model); assert.match(records[0].attribution, /gpt-image-2\.6-sunburst$/);
});
test("provider rejection never stores an image or retries paid generation", async () => {
  const { api, calls, records, uploads } = imageSetup({}, true);
  await assert.rejects(api.generateNewsletterImage(imageInput), /configured image model is unavailable/);
  assert.equal(calls.length, 1); assert.equal(records.length, 0); assert.equal(uploads.length, 0);
});
