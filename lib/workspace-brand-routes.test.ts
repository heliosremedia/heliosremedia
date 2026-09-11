import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as policy from "./workspace-brand-storage.ts";

for (const kind of ["testimonials", "trusted-logos"] as const) {
  test(`${kind}: real POST handler rejects foreign attachments before storage or database access`, async () => {
    let role = "EDITOR";
    let verified = 0;
    let created = 0;
    const isPhoto = kind === "testimonials";
    const field = isPhoto ? "photo" : "logo";
    const source = readFileSync(new URL(`../app/api/admin/${kind}/route.ts`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports: Record<string, (request: Request) => Promise<Response>> = {};
    const model = {
      findFirst: async ({ where }: { where: { workspaceId: string } }) => {
        assert.equal(where.workspaceId, "company-a");
        return { id: "existing", [`${field}StorageKey`]: `workspaces/company-b/${kind}/shared.webp` };
      },
      deleteMany: async ({ where }: { where: { workspaceId: string } }) => {
        assert.equal(where.workspaceId, "company-a");
        return { count: 1 };
      },
      aggregate: async () => ({ _max: { displayOrder: 0 } }),
      create: async ({ data }: { data: Record<string, unknown> }) => { created++; return data; },
    };
    const modules: Record<string, unknown> = {
      "next/cache": { revalidatePath() {} },
      "next/server": { NextResponse: Response },
      "@/lib/auth/session": { getAdminSession: async () => ({ workspaceId: "company-a", role }) },
      "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      "@/lib/prisma": { prisma: { testimonial: model, trustedLogo: model } },
      "@/lib/testimonials": { TESTIMONIAL_CHARACTER_LIMIT: 1000 },
      "@/lib/workspace-brand-storage": policy,
      "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
      "@/lib/workspace-brand-assets": { verifyRegisteredBrandImage: async () => { verified++; } },
    };
    runInNewContext(compiled, { exports, require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected module ${name}`);
      return modules[name];
    }, Error, URL, console });
    const request = (key: string) => new Request("https://studio.example/api", { method: "POST", body: JSON.stringify({
      agentName: "Agent", testimonial: "Great work", organizationName: "Company", [`${field}StorageKey`]: key, [`${field}Url`]: "https://foreign.example/image.webp",
    }) });
    const foreign = await exports.POST(request(`workspaces/company-b/${kind}/image.webp`));
    assert.equal(foreign.status, 400);
    assert.equal(verified, 0);
    assert.equal(created, 0);
    role = "VIEWER";
    assert.equal((await exports.POST(request(`workspaces/company-a/${kind}/image.webp`))).status, 403);
    assert.equal(created, 0);
    role = "EDITOR";
    const own = await exports.POST(request(`workspaces/company-a/${kind}/image.webp`));
    assert.equal(own.status, 201);
    const body = await own.json();
    const record = isPhoto ? body.testimonial : body.logo;
    assert.equal(record.workspaceId, "company-a");
    assert.equal(record[`${field}Url`], `https://assets.example/workspaces/company-a/${kind}/image.webp`);
    assert.equal(verified, 1);
    assert.equal(created, 1);
    // A corrupted legacy association must not cause deletion of a foreign object.
    // The storage mock intentionally has no delete function.
    const removed = await exports.DELETE(new Request(`https://studio.example/api?${isPhoto ? "testimonialId" : "logoId"}=existing`, { method: "DELETE" }));
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).storageCleanupPending, true);
  });
}
