import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("real recipient resolver intersects every selection mode with company membership and preserves opt-outs", async () => {
  const clients = [
    { id: "a", company: "company-a", groups: ["group"], emailSubscribed: true },
    { id: "b", company: "company-b", groups: ["group"], emailSubscribed: true },
    { id: "out", company: "company-a", groups: ["group"], emailSubscribed: false },
    { id: "suppressed", company: "company-a", groups: ["group"], emailSubscribed: true },
  ].map(row => ({ ...row, displayName: row.id, email: `${row.id}@example.com`, normalizedEmail: `${row.id}@example.com`, archivedAt: null, emailStatus: "VALID" }));
  type SelectionWhere = { id?: { in: string[] }; groupMemberships?: { some: { groupId: { in: string[] } } }; OR?: SelectionWhere[] };
  function selected(row: typeof clients[number], where: SelectionWhere): boolean {
    if (where.OR) return where.OR.some(part => selected(row, part));
    if (where.id) return where.id.in.includes(row.id);
    if (where.groupMemberships) return row.groups.some(group => where.groupMemberships!.some.groupId.in.includes(group));
    return true;
  }
  const exports: { resolveEligibleNewsletterRecipients?: (workspaceId: string, selection: unknown) => Promise<{ eligible: Array<{ id: string }> }> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/prisma": { prisma: {
      communicationClient: { findMany: async ({ where }: { where: { AND: SelectionWhere[]; workspaceMemberships: { some: { workspaceId: string } } } }) => clients.filter(row => row.company === where.workspaceMemberships.some.workspaceId && where.AND.every(part => selected(row, part))) },
      communicationSuppression: { findMany: async () => [{ normalizedEmail: "suppressed@example.com" }] },
      marketingEmailPreference: { findMany: async () => [] },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./recipients.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (id: string) => modules[id] });
  const resolve = exports.resolveEligibleNewsletterRecipients!;
  for (const mode of ["ALL", "GROUPS", "INDIVIDUALS", "GROUPS_AND_INDIVIDUALS"]) {
    const result = await resolve("company-a", { mode, groupIds: ["group"], clientIds: ["a", "b", "out", "suppressed"] });
    assert.equal(result.eligible.length, 1, mode);
    assert.equal(result.eligible[0].id, "a", mode);
  }
  assert.equal((await resolve("company-a", { mode: "INDIVIDUALS", clientIds: ["b"], groupIds: [] })).eligible.length, 0);
  await assert.rejects(resolve("", { mode: "ALL" }));
});
