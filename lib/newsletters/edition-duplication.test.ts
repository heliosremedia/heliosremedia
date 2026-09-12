import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as imagePolicy from "./source-images.ts";

function load<T>(file: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, Date, Error, require: (id: string) => modules[id] ?? {},
  });
  return exports as T;
}
const imageValidation = load<typeof import("./image-validation")>("./image-validation.ts", { "./source-images": imagePolicy });

test("stored image normalization preserves NONE and rejects invalid public URLs", () => {
  assert.equal(imageValidation.storedNewsletterImageBlock({ id: "block", content: { imageUrl: "https://foreign.example/image.png", imageSelection: { mode: "NONE" } } }).content.imageUrl, "");
  assert.equal(imageValidation.storedNewsletterImageBlock({ id: "block", content: { imageUrl: "https://external.example/image.png" } }).content.imageSelection.mode, "CUSTOM");
  assert.throws(() => imageValidation.storedNewsletterImageBlock({ id: "block", content: { imageUrl: "javascript:alert(1)" } }), /invalid/);
});

test("duplication validates references and fresh authorization before creating a review-only copy", async () => {
  for (const scenario of ["valid", "denied", "revoked", "stale", "foreign-edition", "foreign-source", "foreign-image", "missing-source"]) {
    const actor = { userId: "actor", workspaceId: "a", sessionVersion: 1 };
    let allowed = scenario !== "denied";
    let checks = 0;
    const writes: Record<string, unknown>[] = [];
    const source = {
      id: "edition", seriesId: "series", rowVersion: 4, cycleKey: "2026-10", status: "SENT", subject: "Original", previewText: "Preview", contentNotes: {}, internalNotes: "Notes", intendedSendAt: new Date("2026-10-01"),
      approvedRevisionId: "old-approval", delivery: { campaignId: "old-campaign" },
      blocks: [{ id: "block", type: "HERO", position: 0, internalLabel: "Hero", aiGenerated: false,
        content: { body: "Original copy", imageUrl: "https://assets.example/workspaces/a/newsletter/image.png", imageSelection: { mode: "CUSTOM" }, imageCandidates: [{ label: "Stale foreign metadata" }] },
        sources: [{ id: "source", sourceId: null, sourceType: "ADMIN_CONTENT", sourceTitle: "Old source", sourceSnapshot: { workspaceId: scenario === "foreign-source" ? "b" : "a" } }],
      }],
    };
    const tx = {
      $queryRaw: async (sql: TemplateStringsArray, ...params: unknown[]) => {
        assert.match(sql.join("?"), /FOR UPDATE OF edition/); assert.deepEqual(params, ["edition", 4, "a", false]);
        return scenario === "stale" ? [] : [{ id: "edition" }];
      },
      newsletterEdition: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push(data); return { id: "copy" }; } },
    };
    const api = load<{ duplicateNewsletterEdition: (id: string, actor: unknown) => Promise<unknown> }>("./edition-duplication.ts", {
      "node:crypto": { randomUUID: () => "unique-copy" },
      "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async (db: unknown, captured: { workspaceId: string }) => { assert.equal(db, tx); assert.equal(captured.workspaceId, "a"); checks++; if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
      "./ownership": { resolveNewsletterWorkspace: async () => "a" },
      "./image-validation": {
        storedNewsletterImageBlock: imageValidation.storedNewsletterImageBlock,
        verifyNewsletterBlockImages: async (workspaceId: string, blocks: unknown[]) => { assert.equal(workspaceId, "a"); assert.equal(blocks.length, 1); if (scenario === "foreign-image") throw new Error("Foreign image"); actor.workspaceId = "b"; },
      },
      "./block-source-context": { refreshNewsletterBlockSources: async (workspaceId: string) => {
        assert.equal(workspaceId, "a"); if (scenario === "missing-source") throw new Error("Source unavailable"); if (scenario === "revoked") allowed = false;
        return [{ id: "block-source:source", kind: "ADMIN_CONTENT", label: "Current source", excerpt: "Owned copy", imageCandidates: [] }];
      } },
      "@/lib/prisma": { prisma: {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
        newsletterEdition: { findUnique: async ({ where }: { where: { series: { workspaceId: string } } }) => { assert.equal(where.series.workspaceId, "a"); return scenario === "foreign-edition" ? null : source; } },
      } },
    });
    const operation = api.duplicateNewsletterEdition("edition", actor);
    if (scenario !== "valid") {
      await assert.rejects(operation, /FORBIDDEN|CHANGED|not found|ownership|Foreign image|Source unavailable/);
      assert.equal(writes.length, 0); continue;
    }
    await operation; assert.equal(checks, 2); assert.equal(writes.length, 1);
    const copy = writes[0];
    assert.equal(copy.status, "NEEDS_REVIEW"); assert.equal(copy.createdById, "actor"); assert.equal(copy.seriesId, "series"); assert.equal(copy.cycleKey, "2026-10-copy-unique-copy");
    for (const key of ["approvedRevisionId", "approvals", "delivery", "jobs"]) assert.equal(key in copy, false);
    const blocks = (copy.blocks as { create: { content: { body: string; imageCandidates: unknown[] }; sources: { create: { sourceSnapshot: { workspaceId: string } }[] } }[] }).create;
    assert.equal(blocks[0].content.body, "Original copy"); assert.equal(blocks[0].content.imageCandidates.length, 0); assert.equal(blocks[0].sources.create[0].sourceSnapshot.workspaceId, "a");
    assert.equal(source.status, "SENT"); assert.equal(source.approvedRevisionId, "old-approval");
  }
});
