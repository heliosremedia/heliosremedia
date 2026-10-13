import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { setWorkspaceMarketingPreference } from "./workspace-consent";
import { setMarketingPreference } from "./preferences";

type PreferenceAction = { clientId: string; action: "unsubscribe" | "resubscribe"; reason?: string; consentSource?: string; confirmation?: boolean };

/** Route company consent to the scoped writer; preserve only attributable legacy compatibility. */
export async function updateAdminMarketingPreference(actor: WorkspaceWriteActor & { email: string }, input: PreferenceAction) {
  const legacy = await prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const client = await tx.communicationClient.findFirst({
      where: { id: input.clientId, workspaceMemberships: { some: { workspaceId: actor.workspaceId } } },
      select: { id: true, displayName: true, email: true, normalizedEmail: true },
    });
    if (!client) throw new Error("CONSENT_CLIENT_NOT_FOUND");
    if (tenantContextEnabled() || await tx.workspaceMarketingPreference.findUnique({
      where: { workspaceId_normalizedEmail: { workspaceId: actor.workspaceId, normalizedEmail: client.normalizedEmail } }, select: { id: true },
    })) return null;
    // The legacy writer changes shared address projections. Serialize its short
    // compatibility transaction against company provisioning and client changes.
    await tx.$executeRaw`LOCK TABLE "Workspace", "CommunicationClient", "CommunicationClientWorkspace" IN SHARE ROW EXCLUSIVE MODE`;
    const workspaces = await tx.workspace.findMany({ take: 2, select: { id: true } });
    if (workspaces.length !== 1 || workspaces[0].id !== actor.workspaceId) throw new Error("CONSENT_COMPANY_MIGRATION_REQUIRED");
    // Re-read after the table lock, including attribution of every affected row.
    const owned = await tx.communicationClient.findFirst({
      where: { id: client.id, email: client.email, normalizedEmail: client.normalizedEmail, workspaceMemberships: { some: { workspaceId: actor.workspaceId } } },
      select: { id: true },
    });
    const ambiguous = await tx.communicationClient.count({ where: { normalizedEmail: client.normalizedEmail, workspaceMemberships: { none: { workspaceId: actor.workspaceId } } } });
    if (!owned || ambiguous) throw new Error("CONSENT_COMPANY_MIGRATION_REQUIRED");
    const resubscribing = input.action === "resubscribe";
    {
      const [preference, suppression] = await Promise.all([
        tx.marketingEmailPreference.findUnique({ where: { normalizedEmail: client.normalizedEmail }, select: { status: true } }),
        tx.communicationSuppression.findFirst({ where: { normalizedEmail: client.normalizedEmail, releasedAt: null }, select: { id: true } }),
      ]);
      if (preference?.status === "SUPPRESSED" || suppression) throw new Error("CONSENT_SAFETY_BLOCK");
    }
    const preference = await setMarketingPreference({
      email: client.email, status: resubscribing ? "SUBSCRIBED" : "UNSUBSCRIBED",
      source: resubscribing ? "ADMIN_CONFIRMED_CONSENT" : "ADMIN_UNSUBSCRIBE",
      reason: input.reason?.trim().slice(0, 500) || null, actorId: actor.userId,
      resubscribeMethod: resubscribing ? input.consentSource!.trim().slice(0, 200) : null,
    }, tx);
    await tx.auditEvent.create({ data: {
      workspaceId: actor.workspaceId, actorId: actor.userId, actorEmail: actor.email,
      action: resubscribing ? "MARKETING_EMAIL_RESUBSCRIBED" : "MARKETING_EMAIL_UNSUBSCRIBED",
      entityType: "CommunicationClient", entityId: client.id,
      summary: `${client.displayName} was ${resubscribing ? "resubscribed with recorded consent" : "unsubscribed"} from marketing email.`,
      metadata: { normalizedEmail: preference.normalizedEmail, ...(resubscribing ? { consentSource: input.consentSource! } : {}) },
    } });
    return preference;
  });
  if (legacy) return legacy;
  // The read/selection transaction has ended. The company writer owns a fresh
  // transaction and rechecks current actor/client authority before any mutation.
  return setWorkspaceMarketingPreference(prisma, actor, {
    clientId: input.clientId, status: input.action === "resubscribe" ? "SUBSCRIBED" : "UNSUBSCRIBED",
    confirmation: input.confirmation, consentSource: input.consentSource, reason: input.reason,
  });
}
