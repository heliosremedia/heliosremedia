import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("series updates reject foreign series or audiences before approval and schedule mutations", async () => {
  for (const scenario of ["series", "group", "client"]) {
    let mutations = 0;
    const exports: { updateSeries?: (id: string, input: unknown, workspaceId: string) => Promise<unknown> } = {};
    const tx = {
      newsletterSeries: { findUnique: async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => {
        assert.equal(where.AND[0].workspaceId, "a");
        return scenario === "series" ? null : { id: "series", workspaceId: "a" };
      } },
      communicationGroup: { count: async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => {
        assert.equal(where.AND[0].workspaceId, "a"); return scenario === "group" ? 0 : 1;
      } },
      communicationClient: { count: async ({ where }: { where: { workspaceMemberships: { some: { workspaceId: string } } } }) => {
        assert.equal(where.workspaceMemberships.some.workspaceId, "a"); return scenario === "client" ? 0 : 1;
      } },
      newsletterEdition: { findMany: async () => { mutations++; throw new Error("Unexpected schedule access"); } },
    };
    const modules: Record<string, unknown> = {
      "server-only": {},
      "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      "@/lib/newsletters/ownership": {}, "@/lib/workspaces": {},
      "@/lib/prisma": { prisma: { $transaction: async (callback: (db: typeof tx) => unknown) => callback(tx) } },
      "./recurrence": { nextOccurrence: () => new Date("2026-10-01"), generationDateForSend: () => null },
      "./recipients": {}, "./content-hash": {},
    };
    runInNewContext(ts.transpileModule(readFileSync(new URL("./studio.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (id: string) => modules[id], Intl, Date });
    await assert.rejects(exports.updateSeries!("series", { name: "Test", groupIds: ["group"], individualRecipientIds: ["client"], sendRule: "SECOND_THURSDAY_09:00", generationRule: "MANUAL" }, "a"), scenario === "series" ? /not found/ : /audience is unavailable/);
    assert.equal(mutations, 0);
  }
});
