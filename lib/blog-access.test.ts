import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("legacy Blog guard denies unauthenticated, read-only, foreign and ambiguous workspace access", async () => {
  let session: { role: string; workspaceId: string } | null = null;
  let workspaces = [{ id: "helios" }];
  let reads = 0;
  const exports: { requireLegacyBlogAccess?: () => Promise<Response | null> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {}, "next/server": { NextResponse: Response },
    "@/lib/auth/session": { getAdminSession: async () => session },
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => { reads++; return workspaces; } } } },
  };
  const source = readFileSync(new URL("./blog-access.ts", import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected dependency ${name}`);
    return modules[name];
  } });
  const guard = exports.requireLegacyBlogAccess!;
  assert.equal((await guard())?.status, 403);
  session = { role: "VIEWER", workspaceId: "helios" };
  assert.equal((await guard())?.status, 403);
  assert.equal(reads, 0);
  session = { role: "EDITOR", workspaceId: "helios" };
  assert.equal(await guard(), null);
  workspaces = [{ id: "other" }];
  assert.equal((await guard())?.status, 409);
  workspaces = [{ id: "helios" }, { id: "other" }];
  assert.equal((await guard())?.status, 409);
  workspaces = [];
  assert.equal((await guard())?.status, 409);
});

test("every Blog admin handler runs the guard before its own work", () => {
  const root = new URL("../app/api/admin/blog/", import.meta.url);
  const files = readdirSync(root, { recursive: true }).filter(name => String(name).endsWith("route.ts"));
  assert.ok(files.length >= 9);
  for (const file of files) {
    const source = readFileSync(new URL(String(file), root), "utf8");
    const handlers = [...source.matchAll(/export async function (GET|POST|PATCH|DELETE)\([^\n]*\) \{\n([^]*?)(?=\nexport async function|$)/g)];
    assert.ok(handlers.length > 0, String(file));
    for (const handler of handlers) assert.ok(handler[2].startsWith("  const accessError = await requireLegacyBlogAccess();\n  if (accessError) return accessError;"), `${file}: ${handler[1]}`);
  }
});
