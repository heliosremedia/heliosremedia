import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/app/generated/prisma/client";
import { updateCompatibilityMembership } from "./workspace-membership-lifecycle.ts";

test("membership synchronization only changes access explicitly requested by administrator", async () => {
  const oldWrite = process.env.STUDIO_V2_MEMBERSHIP_WRITES_ENABLED;
  const oldRead = process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED;
  const calls: Array<{update: Record<string, unknown>}> = [];
  const tx = { workspaceMembership: { upsert: async (args: {update: Record<string, unknown>}) => { calls.push(args); } } } as unknown as Prisma.TransactionClient;
  const user = { id: 'alice', workspaceId: 'company-a', active: true, role: 'EDITOR' as const };
  try {
    process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = 'false';
    process.env.STUDIO_V2_MEMBERSHIP_WRITES_ENABLED = 'false';
    await updateCompatibilityMembership(tx, user, { role: true, active: true });
    assert.equal(calls.length, 0, 'flag off never requires the new table');
    process.env.STUDIO_V2_MEMBERSHIP_WRITES_ENABLED = 'true';
    await updateCompatibilityMembership(tx, user, {});
    assert.equal(calls.length, 0, 'profile/password changes cannot restore revoked membership');
    await updateCompatibilityMembership(tx, user, { role: true });
    assert.deepEqual(calls[0].update, {role: 'EDITOR'}, 'role change preserves suspended/revoked status');
    await updateCompatibilityMembership(tx, { ...user, active: false }, {active: true});
    assert.deepEqual(calls[1].update, {status: 'SUSPENDED'});
    await updateCompatibilityMembership(tx, user, {active: true});
    assert.deepEqual(calls[2].update, {status: 'ACTIVE'}, 'only explicit reactivation restores access');
  } finally {
    if(oldWrite === undefined) delete process.env.STUDIO_V2_MEMBERSHIP_WRITES_ENABLED; else process.env.STUDIO_V2_MEMBERSHIP_WRITES_ENABLED=oldWrite;
    if(oldRead === undefined) delete process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED; else process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED=oldRead;
  }
});
