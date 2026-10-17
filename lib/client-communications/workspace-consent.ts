import "server-only";
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { normalizeEmail } from "./normalization";
import { workspaceMarketingEligibility } from "./workspace-consent-policy";

type ConsentReader = Pick<Prisma.TransactionClient, "workspaceMarketingPreference" | "marketingEmailPreference" | "communicationSuppression">;

/** Caller supplies authoritative workspace identity; no fallback to global consent. */
export async function readWorkspaceMarketingEligibility(db: ConsentReader, workspaceId: string, email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!workspaceId || !normalizedEmail) return { eligible: false, reason: "COMPANY_CONSENT_REQUIRED" as const };
  const [company, legacy, safety] = await Promise.all([
    db.workspaceMarketingPreference.findUnique({ where: { workspaceId_normalizedEmail: { workspaceId, normalizedEmail } }, select: { status: true } }),
    db.marketingEmailPreference.findUnique({ where: { normalizedEmail }, select: { status: true } }),
    db.communicationSuppression.findFirst({ where: { normalizedEmail, releasedAt: null }, select: { id: true } }),
  ]);
  return workspaceMarketingEligibility({ companyStatus: company?.status, legacyStatus: legacy?.status, safetySuppressed: !!safety });
}

type AdminConsentInput = { clientId: string; status: "SUBSCRIBED" | "UNSUBSCRIBED"; confirmation?: boolean; consentSource?: string; reason?: string };

/** Own the transaction so preference, history and required audit cannot separate. */
export async function setWorkspaceMarketingPreference(db: Pick<PrismaClient, "$transaction">, actor: WorkspaceWriteActor & { email: string }, input: AdminConsentInput) {
  if (typeof input.clientId !== "string" || !input.clientId || input.clientId.length > 100 || !["SUBSCRIBED", "UNSUBSCRIBED"].includes(input.status)
    || (input.reason !== undefined && typeof input.reason !== "string") || (input.consentSource !== undefined && typeof input.consentSource !== "string")
    || (input.status === "SUBSCRIBED" && (input.confirmation !== true || !input.consentSource?.trim()))) throw new Error("CONSENT_INVALID_INPUT");
  return db.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    // Stabilize the shared contact and its owned membership without mutating them.
    await tx.$queryRaw`SELECT id FROM "CommunicationClient" WHERE id=${input.clientId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "CommunicationClientWorkspace" WHERE "clientId"=${input.clientId} AND "workspaceId"=${actor.workspaceId} FOR SHARE`;
    const client = await tx.communicationClient.findFirst({
      where: { id: input.clientId, archivedAt: null, workspaceMemberships: { some: { workspaceId: actor.workspaceId } } },
      select: { id: true, email: true, normalizedEmail: true },
    });
    if (!client) throw new Error("CONSENT_CLIENT_NOT_FOUND");
    const normalizedEmail = normalizeEmail(client.email);
    if (!normalizedEmail || normalizedEmail !== client.normalizedEmail) throw new Error("CONSENT_CLIENT_INVALID");
    if (input.status === "SUBSCRIBED") {
      const eligibility = await readWorkspaceMarketingEligibility(tx, actor.workspaceId, normalizedEmail);
      if (eligibility.reason === "PROTECTED_BLOCK") throw new Error("CONSENT_PROTECTED_BLOCK");
    }
    const where = { workspaceId_normalizedEmail: { workspaceId: actor.workspaceId, normalizedEmail } };
    const previous = await tx.workspaceMarketingPreference.findUnique({ where, select: { id: true, status: true } });
    if (previous?.status === input.status) return { changed: false, status: previous.status };
    const source = input.status === "SUBSCRIBED" ? "ADMIN_CONFIRMED_CONSENT" : "ADMIN_UNSUBSCRIBE";
    const data = { status: input.status, source, reason: input.reason?.trim().slice(0, 500) || null, actorId: actor.userId, effectiveAt: new Date() };
    const preference = await tx.workspaceMarketingPreference.upsert({ where,
      create: { workspaceId: actor.workspaceId, normalizedEmail, ...data }, update: data,
    });
    await tx.workspaceMarketingPreferenceEvent.create({ data: {
      workspaceId: actor.workspaceId, preferenceId: preference.id, previousStatus: previous?.status,
      status: input.status, source, reason: data.reason, actorId: actor.userId,
    } });
    await tx.auditEvent.create({ data: {
      workspaceId: actor.workspaceId, actorId: actor.userId, actorEmail: actor.email,
      action: input.status === "SUBSCRIBED" ? "WORKSPACE_MARKETING_SUBSCRIBED" : "WORKSPACE_MARKETING_UNSUBSCRIBED",
      entityType: "WorkspaceMarketingPreference", entityId: preference.id, summary: "Company marketing preference changed.",
      metadata: { clientId: client.id, ...(input.status === "SUBSCRIBED" ? { consentSource: input.consentSource!.trim().slice(0, 200) } : {}) },
    } });
    return { changed: true, status: preference.status };
  });
}
