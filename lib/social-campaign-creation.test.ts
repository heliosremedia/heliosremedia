import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, Date, console, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}

test("campaign creation checks access before transactional source reads and rejects unsupported or foreign source IDs", async () => {
  let allowed = true;
  let projects = true;
  let source = true;
  let writes = 0;
  const events: string[] = [];
  const tx = {
    project: { findMany: async ({ where }: { where: { workspaceId: string } }) => { events.push("projects"); assert.equal(where.workspaceId, "a"); return projects ? [{ id: "project" }] : []; } },
    socialCampaign: { create: async ({ data }: { data: { workspaceId: string; verifiedSourceFacts: unknown; sourceRecordIds: unknown } }) => { events.push("write"); writes++; assert.equal(data.workspaceId, "a"); assert.equal(JSON.stringify(data.sourceRecordIds), '["project"]'); assert.equal(JSON.stringify(data.verifiedSourceFacts), '{"title":"Owned facts"}'); return { id: "campaign" }; } },
  };
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/social/campaigns/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a", userId: "actor", sessionVersion: 1 }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { events.push("access"); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
    "@/lib/social/core": { SOCIAL_PLATFORMS: ["FACEBOOK"], POST_TYPES: { FACEBOOK: ["IMAGE_POST"] } },
    "@/lib/social/studio": { verifiedSourceFacts: async (_type: string, id: string, workspaceId: string, db: unknown) => { events.push("source"); assert.equal(id, "project"); assert.equal(workspaceId, "a"); assert.equal(db, tx); if (!source) throw new Error("not found"); return { title: "Owned facts" }; } },
  });
  const call = (sourceType = "PROJECT", sourceRecordId = "project") => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ internalName: "Campaign", sourceType, sourceRecordId, platforms: ["FACEBOOK"], workspaceId: "b" }) }));
  assert.equal((await call("PROJECT", "")).status, 400); assert.equal((await call("MEDIA_LIBRARY")).status, 400); assert.deepEqual(events, []);
  allowed = false; assert.equal((await call()).status, 403); assert.deepEqual(events, ["access"]); events.length = 0;
  allowed = true; projects = false; assert.equal((await call()).status, 409); assert.deepEqual(events, ["access", "projects"]); events.length = 0;
  projects = true; source = false; assert.equal((await call()).status, 409); assert.equal(writes, 0); events.length = 0;
  source = true; assert.equal((await call()).status, 200); assert.deepEqual(events, ["access", "projects", "source", "write"]);
});

test("campaign settings edits revalidate access inside the write transaction", async () => {
  let allowed = false;
  let writes = 0;
  const tx = { socialCampaign: { updateMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); writes++; return { count: 1 }; } } };
  const api = load<{ PATCH: (request: Request, context: { params: Promise<{ campaignId: string }> }) => Promise<Response> }>("../app/api/admin/social/campaigns/[campaignId]/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a", userId: "actor", sessionVersion: 1 }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
    "@/lib/social/core": {}, "@/lib/social/studio": {}, "@/lib/social/campaign-duplication": {}, "@/lib/social/mutation-lock": {}, "@/lib/social/publishing": {}, "@/lib/client-communications/scheduling": {},
  });
  const call = () => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ action: "update-campaign", internalName: "Edit", workspaceId: "b" }) }), { params: Promise.resolve({ campaignId: "campaign" }) });
  assert.equal((await call()).status, 403); assert.equal(writes, 0); allowed = true; assert.equal((await call()).status, 200); assert.equal(writes, 1);
});
