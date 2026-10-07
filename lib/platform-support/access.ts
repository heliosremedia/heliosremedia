import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { requireLockedWorkspaceEditor, type WorkspaceWriteActor } from "@/lib/workspace-write-access";

const SCOPE = "DIAGNOSTICS" as const;
export class SupportDenied extends Error {}
export class SupportInvalid extends Error {}
export function supportEnabled() {
  return tenantContextEnabled() && process.env.STUDIO_V2_SUPPORT_DIAGNOSTICS_ENABLED?.trim().toLowerCase() === "true";
}
function admitted() { if (!supportEnabled()) throw new SupportDenied(); }
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new SupportInvalid();
  return value;
}
async function databaseTime(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  return row.now;
}
async function lockUsers(tx: Prisma.TransactionClient, ids: string[]) {
  // All support operations take target Workspace first, then users in ID order.
  for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id=${id} FOR UPDATE`;
}
async function owner(tx: Prisma.TransactionClient, actor: WorkspaceWriteActor) {
  const access = await requireLockedWorkspaceEditor(tx, actor);
  if (access.role !== "OWNER") throw new SupportDenied();
}
async function operator(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "userId" FROM "PlatformSupportOperator" WHERE "userId"=${userId} FOR SHARE`;
  const enrolled = await tx.platformSupportOperator.findUnique({ where: { userId } });
  const user = await tx.adminUser.findUnique({ where: { id: userId } });
  if (!enrolled?.enabled || !user?.active) throw new SupportDenied();
  return user;
}
async function audit(tx: Prisma.TransactionClient, actorId: string, workspaceId: string | null, grantId: string | null, outcome: string, identities?: { operatorId: string; grantedById: string }) {
  await tx.auditEvent.create({ data: { actorId, workspaceId, action: `SUPPORT_${outcome}`, entityType: "SupportAccessGrant", entityId: grantId,
    summary: `Support ${outcome.toLowerCase()}`, metadata: { requestId: randomUUID(), scope: SCOPE, outcome, grantId, ...(identities ?? {}) } } });
}
async function deniedAudit(actor: WorkspaceWriteActor, grantId: string | null) {
  // No target discovery or attacker-supplied reason is recorded on denial.
  await prisma.$transaction(tx => audit(tx, actor.userId, actor.workspaceId, grantId, "DENIED")).catch(() => {});
}
const grantSelect = { id: true, workspaceId: true, operatorId: true, grantedById: true, scope: true, createdAt: true, expiresAt: true, revokedAt: true } as const;

export async function createSupportGrant(actor: WorkspaceWriteActor, input: Record<string, unknown>) {
  admitted();
  const operatorId = identifier(input.operatorId);
  const minutes = input.durationMinutes;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (input.scope !== SCOPE || !Number.isInteger(minutes) || Number(minutes) < 1 || Number(minutes) > 30 || !reason || reason.length > 600) throw new SupportInvalid();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${actor.workspaceId} FOR UPDATE`;
      await lockUsers(tx, [actor.userId, operatorId]);
      await owner(tx, actor);
      if (operatorId === actor.userId) throw new SupportDenied();
      await operator(tx, operatorId);
      const now = await databaseTime(tx);
      const grant = await tx.supportAccessGrant.create({ data: { workspaceId: actor.workspaceId, operatorId, grantedById: actor.userId, reason, scope: SCOPE, createdAt: now, expiresAt: new Date(now.getTime() + Number(minutes) * 60000) }, select: grantSelect });
      await audit(tx, actor.userId, actor.workspaceId, grant.id, "GRANTED", grant);
      return grant;
    });
  } catch (error) { await deniedAudit(actor, null); throw error; }
}

export async function revokeSupportGrant(actor: WorkspaceWriteActor, input: Record<string, unknown>) {
  admitted(); const id = identifier(input.grantId);
  try {
    return await prisma.$transaction(async tx => {
      await owner(tx, actor);
      await tx.$queryRaw`SELECT id FROM "SupportAccessGrant" WHERE id=${id} AND "workspaceId"=${actor.workspaceId} FOR UPDATE`;
      const grant = await tx.supportAccessGrant.findFirst({ where: { id, workspaceId: actor.workspaceId } });
      if (!grant) throw new SupportDenied();
      if (!grant.revokedAt) await tx.supportAccessGrant.update({ where: { id }, data: { revokedAt: await databaseTime(tx), revokedById: actor.userId } });
      await audit(tx, actor.userId, actor.workspaceId, id, "REVOKED", grant);
      return { revoked: true, grantId: id };
    });
  } catch (error) { await deniedAudit(actor, id); throw error; }
}

export async function readSupportDiagnostics(actor: WorkspaceWriteActor, grantId: unknown) {
  admitted(); const id = identifier(grantId);
  try {
    // This lookup selects lock identities only. It never grants access or returns data.
    const hint = await prisma.supportAccessGrant.findUnique({ where: { id }, select: { workspaceId: true, operatorId: true, grantedById: true } });
    if (!hint || hint.operatorId !== actor.userId) throw new SupportDenied();
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${hint.workspaceId} FOR UPDATE`;
      await lockUsers(tx, [actor.userId, hint.grantedById]);
      const user = await operator(tx, actor.userId);
      if (user.sessionVersion !== actor.sessionVersion || user.workspaceId !== actor.workspaceId) throw new SupportDenied();
      // A valid compatibility login is still required; its role grants no support authority.
      for (const [workspaceId, userId] of [[actor.workspaceId, actor.userId], [hint.workspaceId, hint.grantedById]].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
        await tx.$queryRaw`SELECT id FROM "WorkspaceMembership" WHERE "workspaceId"=${workspaceId} AND "userId"=${userId} FOR SHARE`;
      }
      const login = await tx.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId: actor.userId } } });
      const issuer = await tx.adminUser.findUnique({ where: { id: hint.grantedById } });
      const consent = await tx.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId: hint.workspaceId, userId: hint.grantedById } } });
      if (login?.status !== "ACTIVE" || !issuer?.active || issuer.workspaceId !== hint.workspaceId || consent?.status !== "ACTIVE" || consent.role !== "OWNER") throw new SupportDenied();
      await tx.$queryRaw`SELECT id FROM "SupportAccessGrant" WHERE id=${id} FOR SHARE`;
      const grant = await tx.supportAccessGrant.findUnique({ where: { id } });
      const now = await databaseTime(tx);
      if (!grant || grant.workspaceId !== hint.workspaceId || grant.operatorId !== actor.userId || grant.grantedById !== hint.grantedById || grant.operatorId === grant.grantedById || grant.scope !== SCOPE || grant.revokedAt || grant.createdAt > now || grant.expiresAt <= now || grant.expiresAt.getTime() - grant.createdAt.getTime() > 30 * 60000) throw new SupportDenied();
      const [counts] = await tx.$queryRaw<Array<{ projects: number; activeMemberships: number }>>`SELECT
        (SELECT count(*)::int FROM (SELECT id FROM "Project" WHERE "workspaceId"=${grant.workspaceId} LIMIT 10000) p) AS projects,
        (SELECT count(*)::int FROM (SELECT id FROM "WorkspaceMembership" WHERE "workspaceId"=${grant.workspaceId} AND status='ACTIVE' LIMIT 10000) m) AS "activeMemberships"`;
      await audit(tx, actor.userId, grant.workspaceId, id, "READ", grant);
      if (grant.expiresAt <= await databaseTime(tx)) throw new SupportDenied();
      return { workspaceId: grant.workspaceId, scope: SCOPE, countLimit: 10000, counts: { projects: counts.projects, activeMemberships: counts.activeMemberships } };
    });
  } catch (error) { await deniedAudit(actor, id); throw error; }
}
