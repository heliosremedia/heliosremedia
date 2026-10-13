import assert from 'node:assert/strict';
import test from 'node:test';
import { requireWorkspaceScheduledAction } from './workspace-lifecycle/state.ts';

test('scheduled action admission fails closed on suspension, missing authority and overdue dates while preserving future commitments', async () => {
  const previousTenant = process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED;
  const previousLifecycle = process.env.STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED;
  const cutoff = new Date('2026-10-08T12:00:00Z');
  let row: { lifecycleState: string; lastReactivatedAt: Date | null } | null = { lifecycleState: 'ACTIVE', lastReactivatedAt: cutoff };
  const db = { workspace: { findUnique: async ({ where }: { where: { id: string } }) => { assert.equal(where.id, 'a'); return row; } } } as unknown as Parameters<typeof requireWorkspaceScheduledAction>[0];
  try {
    process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = 'true';
    process.env.STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED = 'true';
    const future = new Date(cutoff.getTime() + 1);
    await requireWorkspaceScheduledAction(db, 'a', future);
    for (const date of [cutoff, new Date(cutoff.getTime() - 1), new Date('invalid')]) await assert.rejects(requireWorkspaceScheduledAction(db, 'a', date), /RECOVERY_REQUIRED/);
    row = { lifecycleState: 'SUSPENDED', lastReactivatedAt: cutoff };
    await assert.rejects(requireWorkspaceScheduledAction(db, 'a', future), /SUSPENDED/);
    row = null;
    await assert.rejects(requireWorkspaceScheduledAction(db, 'a', future), /SUSPENDED/);
    row = { lifecycleState: 'ACTIVE', lastReactivatedAt: null };
    await requireWorkspaceScheduledAction(db, 'a', cutoff);
    process.env.STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED = 'false';
    await requireWorkspaceScheduledAction({} as never, 'a', cutoff);
  } finally {
    if (previousTenant === undefined) delete process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED; else process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = previousTenant;
    if (previousLifecycle === undefined) delete process.env.STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED; else process.env.STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED = previousLifecycle;
  }
});
