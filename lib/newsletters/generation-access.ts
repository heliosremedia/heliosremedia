import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { getBlogOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";

export type NewsletterGenerationContext =
  | { kind: "ADMIN"; actor: WorkspaceWriteActor }
  | { kind: "BACKGROUND"; jobId: string; claimToken: string };

export async function requireNewsletterGenerationAccess(
  tx: Prisma.TransactionClient, editionId: string, workspaceId: string, context: NewsletterGenerationContext,
) {
  if (context.kind === "ADMIN") {
    if (context.actor.workspaceId !== workspaceId) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
    await requireLockedWorkspaceAdministrator(tx, context.actor);
    return;
  }
  if (context.kind !== "BACKGROUND" || !context.jobId || !context.claimToken) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "NewsletterJob" WHERE id = ${context.jobId} AND "editionId" = ${editionId} FOR UPDATE`;
  const job = await tx.newsletterJob.findFirst({
    where: {
      id: context.jobId, editionId, claimToken: context.claimToken, type: "GENERATE", status: "CLAIMED",
      leaseExpiresAt: { gt: new Date() }, edition: { series: await getBlogOwnershipScope(workspaceId) },
    }, select: { id: true },
  });
  if (!job) throw new Error("NEWSLETTER_GENERATION_CLAIM_EXPIRED");
}
