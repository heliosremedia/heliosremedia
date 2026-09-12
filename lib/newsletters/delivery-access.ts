import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";

export type NewsletterDeliveryContext =
  | { kind: "ADMIN"; actor: WorkspaceWriteActor }
  | { kind: "BACKGROUND"; jobId: string; claimToken: string };

/** Authorize the execution, including retries, using stored ownership and a current job lease. */
export async function requireNewsletterDeliveryAccess(
  tx: Prisma.TransactionClient, editionId: string, workspaceId: string, intendedSendAt: Date,
  context: NewsletterDeliveryContext,
) {
  if (context.kind === "ADMIN") {
    if (context.actor.workspaceId !== workspaceId) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
    await requireLockedWorkspaceAdministrator(tx, context.actor);
    await tx.$queryRaw`SELECT id FROM "NewsletterJob" WHERE "editionId" = ${editionId} AND type = 'SEND' AND status = 'CLAIMED' ORDER BY id FOR UPDATE`;
    if (await tx.newsletterJob.findFirst({ where: { editionId, type: "SEND", status: "CLAIMED" }, select: { id: true } })) {
      throw new Error("NEWSLETTER_DELIVERY_BUSY");
    }
    return;
  }
  if (context.kind !== "BACKGROUND" || !context.jobId || !context.claimToken) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "NewsletterJob" WHERE id = ${context.jobId} AND "editionId" = ${editionId} FOR UPDATE`;
  const now = new Date();
  const job = await tx.newsletterJob.findFirst({
    where: {
      id: context.jobId, editionId, claimToken: context.claimToken, type: "SEND", status: "CLAIMED",
      dueAt: intendedSendAt, AND: [{ dueAt: { lte: now } }], leaseExpiresAt: { gt: now },
      edition: { series: await getContentOwnershipScope(workspaceId) },
    }, select: { id: true },
  });
  if (!job) throw new Error("NEWSLETTER_DELIVERY_CLAIM_EXPIRED");
}
