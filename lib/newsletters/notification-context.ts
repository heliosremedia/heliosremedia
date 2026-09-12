import "server-only";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site";
import { resolveNewsletterWorkspace } from "./ownership";
import { sendNewsletterAdminNotification } from "./notifications";

/** Contain the legacy global notification recipient until tenant senders are configured. */
export async function notifyNewsletterEdition(input: {
  editionId: string;
  kind: Parameters<typeof sendNewsletterAdminNotification>[0]["kind"];
  detail: string;
}) {
  const { editionId, kind, detail } = input;
  try {
    const edition = await prisma.newsletterEdition.findUnique({ where: { id: editionId }, select: {
      id: true, subject: true, cycleKey: true, series: { select: { name: true, workspaceId: true } },
    } });
    if (!edition) return { delivered: false, reason: "OWNERSHIP_UNAVAILABLE" as const };
    const workspaceId = await resolveNewsletterWorkspace(edition.series.workspaceId);
    const companies = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (companies.length !== 1 || companies[0].id !== workspaceId) return { delivered: false, reason: "OWNERSHIP_UNAVAILABLE" as const };
    return await sendNewsletterAdminNotification({
      kind, detail,
      editionLabel: edition.subject || `${edition.series.name} · ${edition.cycleKey}`,
      reviewUrl: `${getSiteUrl()}/admin/newsletter-studio/editions/${encodeURIComponent(edition.id)}`,
    });
  } catch {
    // Notification is ancillary. Never turn accepted delivery or completed generation
    // into failed work, or expose edition content/provider errors in logs.
    console.error("Newsletter administrator notification could not be completed", { kind });
    return { delivered: false, reason: "NOTIFICATION_UNAVAILABLE" as const };
  }
}
