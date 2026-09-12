import "server-only";
import { prisma } from "@/lib/prisma";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";

/** Read-only operational evidence. No claim tokens, provider errors or retry authority. */
export async function getNewsletterJobHealth(inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const scope = await getContentOwnershipScope(actor.workspaceId);
    const owned = { edition: { series: scope } };
    const now = new Date();
    const [pending, active, review, failed, jobs] = await Promise.all([
      tx.newsletterJob.count({ where: { ...owned, status: "PENDING" } }),
      tx.newsletterJob.count({ where: { ...owned, status: "CLAIMED", leaseExpiresAt: { gt: now } } }),
      tx.newsletterJob.count({ where: { ...owned, status: "CLAIMED", OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] } }),
      tx.newsletterJob.count({ where: { ...owned, status: "FAILED" } }),
      tx.newsletterJob.findMany({ where: { ...owned, status: { in: ["PENDING", "CLAIMED", "FAILED"] } },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 51,
        select: { id: true, editionId: true, type: true, status: true, dueAt: true, leaseExpiresAt: true, attempts: true,
          edition: { select: { status: true, subject: true, cycleKey: true, series: { select: { name: true, status: true } } } } },
      }),
    ]);
    return {
      observedAt: now.toISOString(), counts: { pending, active, review, failed }, truncated: jobs.length > 50,
      jobs: jobs.slice(0, 50).map(job => ({
        id: job.id, editionId: job.editionId, type: job.type,
        state: job.status === "CLAIMED"
          ? (!job.leaseExpiresAt || job.leaseExpiresAt <= now ? "REVIEW" as const : "ACTIVE" as const)
          : job.status === "FAILED" ? "FAILED" as const : "PENDING" as const,
        dueAt: job.dueAt.toISOString(), attempts: job.attempts,
        editionLabel: (job.edition.subject || `${job.edition.series.name} · ${job.edition.cycleKey}`).slice(0, 160),
        editionStatus: job.edition.status, seriesStatus: job.edition.series.status,
      })),
      automaticRetryAllowed: false as const,
    };
  }, { isolationLevel: "RepeatableRead" });
}
