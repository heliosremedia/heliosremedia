import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

for (const [route, minimumRole] of [["blog", "ADMIN"], ["newsletters", "ADMIN"], ["social", "EDITOR"]] as const) {
  test(`${route} image generation passes the authenticated actor and preserves its role threshold`, async () => {
    const session = { userId: "actor", workspaceId: "a", sessionVersion: 7, role: "ADMIN", email: "test@example.test" };
    let allowed = false;
    let audits = 0;
    const modules: Record<string, unknown> = {
      "next/server": { NextResponse: Response }, "@/lib/blog-access": { requireLegacyBlogAccess: async () => null }, "@/lib/auth/session": { getAdminSession: async () => session },
      "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => session },
      "@/lib/audit": { recordAuditEvent: async (input: { workspaceId: string }) => { assert.equal(input.workspaceId, "a"); audits++; } },
      "@/lib/newsletters/image-assets": { generateNewsletterImage: async (input: { actor: typeof session; minimumRole: string }) => {
        assert.equal(input.actor, session); assert.equal(input.minimumRole, minimumRole); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
        return { id: "asset", publicUrl: "https://assets.test/image.webp", storageKey: "workspaces/a/newsletter-ai/image.webp", altText: "Concept image", model: "fake" };
      } },
    };
    const exports: { POST?: (request: Request) => Promise<Response> } = {};
    runInNewContext(ts.transpileModule(readFileSync(new URL(`../app/api/admin/${route}/images/generate/route.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, console, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
    const call = () => exports.POST!(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ prompt: "A conceptual image", altText: "Concept image", workspaceId: "b", actor: { workspaceId: "b" }, minimumRole: "EDITOR" }) }));
    assert.equal((await call()).status, 403); assert.equal(audits, 0); allowed = true; assert.equal((await call()).status, 201); assert.equal(audits, 1);
  });
}
