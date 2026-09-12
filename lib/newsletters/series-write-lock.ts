import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";

/** Settings changes cannot rewrite the configuration of an active or retryable delivery. */
export async function lockNewsletterSeriesSettings(tx: Prisma.TransactionClient, seriesId: string, actor: WorkspaceWriteActor) {
  await requireLockedWorkspaceAdministrator(tx, actor);
  const scope = await getContentOwnershipScope(actor.workspaceId);
  const legacyAllowed = "OR" in scope;
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "NewsletterSeries"
    WHERE id = ${seriesId} AND ("workspaceId" = ${actor.workspaceId} OR ("workspaceId" IS NULL AND ${legacyAllowed}))
    FOR UPDATE
  `;
  if (!rows.length) throw new Error("Newsletter series was not found.");
  await tx.$queryRaw`
    SELECT id FROM "NewsletterEdition" WHERE "seriesId" = ${seriesId} AND status NOT IN ('SENT', 'CANCELLED') ORDER BY id FOR UPDATE
  `;
  await tx.$queryRaw`
    SELECT job.id FROM "NewsletterJob" job JOIN "NewsletterEdition" edition ON edition.id = job."editionId"
    WHERE edition."seriesId" = ${seriesId} AND job.status IN ('PENDING', 'CLAIMED') ORDER BY job.id FOR UPDATE OF job
  `;
  const [edition, job] = await Promise.all([
    tx.newsletterEdition.findFirst({ where: { seriesId, status: { in: ["GENERATING", "SENDING", "SEND_FAILED", "PARTIALLY_SENT"] } }, select: { id: true } }),
    tx.newsletterJob.findFirst({ where: { edition: { seriesId }, status: "CLAIMED" }, select: { id: true } }),
  ]);
  if (edition || job) throw new Error("NEWSLETTER_SERIES_BUSY");
  const series = await tx.newsletterSeries.findUnique({ where: { id: seriesId, AND: [scope] } });
  if (!series) throw new Error("Newsletter series was not found.");
  return series;
}
