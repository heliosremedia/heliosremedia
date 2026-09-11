import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

test("actual shared generator retains request ownership and rechecks role before provider, upload and persistence", async () => {
  let permitted = false;
  let role = "ADMIN";
  let mode = "normal";
  let providerCalls = 0;
  let stored: Record<string, unknown> | undefined;
  const commands: Array<{ kind: string; key: string }> = [];
  const input = { prompt: "A conceptual architecture photograph", altText: "Conceptual architecture", actor: { userId: "actor", workspaceId: "company-a", sessionVersion: 1 }, minimumRole: "ADMIN" };
  const tx = { newsletterImageAsset: { create: async ({ data }: { data: Record<string, unknown> }) => { stored = data; return data; } } };
  class PutObjectCommand { input: { Key: string }; constructor(input: { Key: string }) { this.input = input; } }
  class DeleteObjectCommand { input: { Key: string }; constructor(input: { Key: string }) { this.input = input; } }
  const exports: { generateNewsletterImage?: (input: unknown) => Promise<unknown> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async (db: unknown, actor: { workspaceId: string }) => { assert.equal(db, tx); assert.equal(actor.workspaceId, "company-a"); if (!permitted) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); return { role }; } },
    "@aws-sdk/client-s3": { PutObjectCommand, DeleteObjectCommand },
    "@/lib/r2": { r2Config: { bucketName: "synthetic" }, r2Client: { send: async (command: PutObjectCommand | DeleteObjectCommand) => { commands.push({ kind: command instanceof PutObjectCommand ? "put" : "delete", key: command.input.Key }); if (mode === "revoke-upload" && command instanceof PutObjectCommand) permitted = false; return {}; } } },
    "@/lib/r2-upload": { createNewsletterAiImageKey: (workspaceId: string) => `workspaces/${workspaceId}/newsletter-ai/image.webp`, getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    "@/lib/prisma": { prisma: { $transaction: (fn: (db: typeof tx) => Promise<unknown>) => fn(tx) } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./image-assets.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, Buffer, AbortSignal, console, process: { env: { OPENAI_API_KEY: "synthetic-not-a-real-key" } },
    fetch: async () => { providerCalls++; if (mode === "revoke-model") permitted = false; if (mode === "mutate-input") input.actor.workspaceId = "company-b"; return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from("synthetic").toString("base64") }] }) }; },
    require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`); return modules[id]; },
  });
  const call = () => exports.generateNewsletterImage!(input);
  await assert.rejects(call(), /WORKSPACE_WRITE_FORBIDDEN/); assert.equal(providerCalls, 0);
  permitted = true; role = "EDITOR"; await assert.rejects(call(), /WORKSPACE_WRITE_FORBIDDEN/); assert.equal(providerCalls, 0);
  role = "ADMIN"; mode = "mutate-input"; await call(); assert.equal(stored?.workspaceId, "company-a"); assert.equal(stored?.storageKey, "workspaces/company-a/newsletter-ai/image.webp");
  input.actor.workspaceId = "company-a"; mode = "revoke-model"; commands.length = 0; stored = undefined;
  await assert.rejects(call(), /WORKSPACE_WRITE_FORBIDDEN/); assert.equal(commands.length, 0); assert.equal(stored, undefined);
  permitted = true; mode = "revoke-upload";
  await assert.rejects(call(), /WORKSPACE_WRITE_FORBIDDEN/); assert.deepEqual(commands, [{ kind: "put", key: "workspaces/company-a/newsletter-ai/image.webp" }, { kind: "delete", key: "workspaces/company-a/newsletter-ai/image.webp" }]); assert.equal(stored, undefined);
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
