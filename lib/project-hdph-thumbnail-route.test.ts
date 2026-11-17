import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "./project-hdph-import.ts";
const source = readFileSync(new URL("../app/api/admin/projects/hdph-import/thumbnail/route.ts", import.meta.url), "utf8");
function fixture({ role = "OWNER", denied = false, host = "https://images.hd.pics/a.jpg", hidden = false, mime = "image/png", bytes = 3, declared = "3", corrupt = false } = {}) {
  const calls: unknown[] = [];
  const exports: { GET?: (request: Request) => Promise<Response> } = {};
  const pipeline = { rotate() { return this; }, resize(options: unknown) { calls.push(options); return this; }, jpeg(options: unknown) { calls.push(options); return this; }, async toBuffer() { if (corrupt) throw Error("private provider detail"); return Buffer.from([1,2]); } };
  const modules: Record<string, unknown> = {
    sharp: { default: (_bytes: unknown, options: unknown) => { calls.push(options); return pipeline; } },
    "@/lib/auth/session": { getAdminSession: async () => role === "NONE" ? null : ({ role, workspaceId: "workspace" }) },
    "@/lib/project-hdph-reader": { projectHdphReader: (workspace: string) => ({ photo: async (site: number, media: number) => { calls.push([workspace,site,media]); if (denied) throw Error("private tenant record"); return { type: "photo", status: hidden ? "hidden" : "visible", images: [{ width: 500, url: host }] }; } }) },
    "@/lib/project-hdph-import": policy,
  };
  const fetcher = async (url: string, options: unknown) => { calls.push({ url, options }); return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mime, "Content-Length": declared } }); };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name: string) => modules[name], Request, Response, URL, AbortSignal, Buffer, Uint8Array, process: { env: {} }, fetch: fetcher });
  return { calls, get: (query = "siteId=12&mediaId=34") => exports.GET!(new Request(`https://studio.test/api/thumbnail?${query}`)) };
}
test("thumbnail route denies unauthenticated/read-only callers before media lookup", async () => {
  for (const [role, status] of [["NONE",401],["VIEWER",403]] as const) { const f=fixture({role}); assert.equal((await f.get()).status,status); assert.equal(f.calls.length,0); }
});
test("thumbnail route binds workspace and IDs, sanitizes JPEG and disables caching", async () => {
  const f=fixture(); const response=await f.get();
  assert.equal(response.status,200); assert.deepEqual(Array.from(f.calls[0] as string[]),["workspace",12,34]);
  assert.equal(response.headers.get("Content-Type"),"image/jpeg"); assert.equal(response.headers.get("Cache-Control"),"private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff"); assert.equal((await response.arrayBuffer()).byteLength,2);
  assert.ok(JSON.stringify(f.calls).includes('"redirect":"error"')); assert.ok(JSON.stringify(f.calls).includes('"width":400')); assert.ok(JSON.stringify(f.calls).includes('"limitInputPixels":60000000'));
});
test("thumbnail route fails closed on invalid IDs, tenant denial, hidden photo or unsafe host", async () => {
  const invalid=fixture(); assert.equal((await invalid.get("siteId=oops&mediaId=34")).status,422); assert.equal(invalid.calls.length,0);
  for (const options of [{denied:true},{hidden:true},{host:"https://127.0.0.1/private"}]) { const f=fixture(options); const response=await f.get(); assert.equal(response.status,422); assert.equal(await response.text(),""); assert.equal(f.calls.length,1); }
});
test("thumbnail route rejects nonimages, declared/streamed oversize and corrupt decode without leaking details", async () => {
  for (const options of [{mime:"text/html"},{declared:String(8*1024*1024+1)},{bytes:8*1024*1024+1,declared:"0"},{corrupt:true}]) { const f=fixture(options); const response=await f.get(); assert.equal(response.status,422); assert.equal(await response.text(),""); }
});
