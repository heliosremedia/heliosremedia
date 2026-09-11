import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

test("actual shared generator checks membership before provider use and persists workspace ownership", async () => {
  let permitted = false;
  let providerCalls = 0;
  let stored: Record<string, unknown> | undefined;
  const exports: { generateNewsletterImage?: (input: unknown) => Promise<unknown> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/workspaces": { requireWorkspaceId: async () => { if (!permitted) throw new Error("No access"); return "company-a"; } },
    "@aws-sdk/client-s3": { PutObjectCommand: class { input: unknown; constructor(input: unknown) { this.input = input; } }, DeleteObjectCommand: class {} },
    "@/lib/r2": { r2Config: { bucketName: "synthetic" }, r2Client: { send: async () => ({}) } },
    "@/lib/r2-upload": { createNewsletterAiImageKey: (workspaceId: string) => `workspaces/${workspaceId}/newsletter-ai/image.webp`, getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    "@/lib/prisma": { prisma: { newsletterImageAsset: { create: async ({ data }: { data: Record<string, unknown> }) => { stored = data; return data; } } } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./image-assets.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Buffer, AbortSignal, console, process: { env: { OPENAI_API_KEY: "synthetic-not-a-real-key" } },
    fetch: async () => { providerCalls++; return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from("synthetic").toString("base64") }] }) }; },
    require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`); return modules[id]; },
  });
  const input = { prompt: "A conceptual architecture photograph", altText: "Conceptual architecture", actorId: "actor" };
  await assert.rejects(exports.generateNewsletterImage!(input), /No access/);
  assert.equal(providerCalls, 0);
  permitted = true;
  await exports.generateNewsletterImage!(input);
  assert.equal(providerCalls, 1);
  assert.equal(stored?.workspaceId, "company-a");
  assert.equal(stored?.storageKey, "workspaces/company-a/newsletter-ai/image.webp");
});

test("image ownership expansion preserves legacy assets and restricts company deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "NewsletterImageAsset" (id TEXT PRIMARY KEY, "storageKey" TEXT);
      INSERT INTO "Workspace" VALUES ('a');
      INSERT INTO "NewsletterImageAsset" VALUES ('legacy','newsletter/ai/legacy.webp');`);
    await db.exec(readFileSync(new URL("../../prisma/migrations/20260911160000_editorial_image_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "NewsletterImageAsset" (id,"storageKey") VALUES ('old-writer','old.webp');
      INSERT INTO "NewsletterImageAsset" VALUES ('new','workspaces/a/newsletter-ai/new.webp','a');`);
    assert.deepEqual((await db.query(`SELECT "storageKey", "workspaceId" FROM "NewsletterImageAsset" WHERE id='legacy'`)).rows, [{ storageKey: "newsletter/ai/legacy.webp", workspaceId: null }]);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`), /foreign key/i);
    await assert.rejects(db.exec(`UPDATE "NewsletterImageAsset" SET "workspaceId"='missing' WHERE id='new'`), /foreign key/i);
  } finally { await db.close(); }
});
