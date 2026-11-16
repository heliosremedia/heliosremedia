import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/api/admin/projects/[projectId]/draft/route.ts", import.meta.url), "utf8");
function fixture({ role = "OWNER", workspaceId = "w1", status = "DRAFT", changed = false, linked = false, auditFailure = false } = {}) {
  const calls: unknown[] = [];
  const project = { title: "Test draft", status, updatedAt: new Date("2026-11-16T10:00:00Z"), _count: { media: 2, socialCampaigns: linked ? 1 : 0, socialCampaignProjects: 0 } };
  const exports: Record<string, (...args: unknown[]) => Promise<{ status: number; body: Record<string, unknown> }>> = {};
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, init?: {status?: number}) => ({ body, status: init?.status ?? 200 }) } },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/auth/session": { getAdminSession: async () => role === "NONE" ? null : ({ role, workspaceId, userId: "u1", email: "test@example.test" }) },
    "@/lib/prisma": { prisma: {
      project: { findFirst: async ({where}: {where: {workspaceId:string}}) => where.workspaceId === "w1" ? project : null },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
        project: { deleteMany: async ({where}: {where: Record<string,unknown>}) => { calls.push(where); return { count: !changed && !linked && status === "DRAFT" && where.workspaceId === "w1" && where.title === project.title && String(where.updatedAt) === String(project.updatedAt) ? 1 : 0 }; } },
        auditEvent: { create: async () => { if(auditFailure) throw new Error("audit unavailable"); calls.push("audit"); } },
      }),
    } },
  };
  vm.runInNewContext(ts.transpileModule(source,{ compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, { exports, require: (name:string)=>modules[name], console:{error(){}}, Date, Number });
  const context = { params: Promise.resolve({ projectId: "p1" }) };
  return { calls, get:()=>exports.GET({},context), remove:(body:unknown = {title:"Test draft",updatedAt:project.updatedAt.toISOString()})=>exports.DELETE({json:async()=>body},context) };
}

test("draft deletion requires owner/admin and remains tenant scoped", async()=>{
  for(const role of ["NONE","VIEWER","EDITOR"]) { const f=fixture({role}); assert.equal((await f.get()).status,403);assert.equal((await f.remove()).status,403);assert.equal(f.calls.length,0); }
  const other=fixture({workspaceId:"w2"});assert.equal((await other.get()).status,404);assert.equal((await other.remove()).status,409);
});
test("published/archived drafts and linked campaigns cannot be deleted",async()=>{
  for(const status of ["PUBLISHED","ARCHIVED"]) {const f=fixture({status});assert.equal((await f.get()).status,409);assert.equal((await f.remove()).status,409);}
  const linked=fixture({linked:true});assert.equal((await linked.get()).status,409);assert.equal((await linked.remove()).status,409);
});
test("named snapshot confirmation and atomic predicate prevent stale or racing deletes",async()=>{
  assert.equal((await fixture().remove({title:"Wrong title",updatedAt:"2026-11-16T10:00:00Z"})).status,409);
  assert.equal((await fixture().remove({title:"Test draft",updatedAt:"invalid"})).status,400);
  assert.equal((await fixture({changed:true}).remove()).status,409);
  const f=fixture();assert.equal((await f.get()).body.mediaCount,2);assert.equal((await f.remove()).status,200);
  const where=f.calls[0] as Record<string,unknown>;assert.equal(where.status,"DRAFT");assert.equal(where.workspaceId,"w1");assert.equal(where.id,"p1");assert.ok(where.updatedAt);assert.ok(where.socialCampaigns);assert.ok(where.socialCampaignProjects);assert.equal(f.calls[1],"audit");
});
test("audit failures do not report deletion success",async()=>{assert.equal((await fixture({auditFailure:true}).remove()).status,500);});
test("Delete Draft sits under Edit only for drafts and requires typed confirmation",()=>{
  const list=readFileSync(new URL("../app/admin/projects/ProjectListManager.tsx",import.meta.url),"utf8");
  const button=readFileSync(new URL("../app/admin/projects/DeleteDraftButton.tsx",import.meta.url),"utf8");
  assert.match(list,/>Edit →<\/Link>[\s\S]*?project.status === "DRAFT" \? <DeleteDraftButton/);
  assert.match(button,/typedTitle !== confirmation.title/);assert.match(button,/This cannot be undone/);assert.match(button,/showModal/);assert.match(button,/onCancel/);assert.match(button,/Original Cloudflare files are not deleted/);
  assert.doesNotMatch(source,/r2Client|deleteObject|cloudflare.*delete/i);
});
