import "server-only";
import type { NewsletterEditionStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBlogOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";

type Action = "revoke-approval" | "cancel" | "reschedule";
const states: Record<Action, NewsletterEditionStatus[]> = {
  "revoke-approval": ["APPROVED", "SCHEDULED"],
  cancel: ["SCHEDULED", "NEEDS_REVIEW", "APPROVED"],
  reschedule: ["AWAITING_GENERATION", "DRAFT_GENERATED", "NEEDS_REVIEW", "APPROVED", "SCHEDULED", "PAUSED", "MISSED_APPROVAL", "GENERATION_FAILED"],
};

export async function transitionNewsletterEdition(input: {
  actor: WorkspaceWriteActor; editionId: string; expectedVersion: number; action: Action; intendedSendAt?: Date;
}) {
  const actor = { ...input.actor };
  const { editionId, expectedVersion, action } = input;
  const intendedSendAt = input.intendedSendAt ? new Date(input.intendedSendAt) : undefined;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("NEWSLETTER_EDITION_CHANGED");
  if (action === "reschedule" && (!intendedSendAt || !Number.isFinite(intendedSendAt.getTime()) || intendedSendAt.getTime() <= Date.now())) {
    throw new Error("Choose a future send date.");
  }
  const now = new Date();
  await prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const claimed = await tx.newsletterEdition.updateMany({
      where: { id: editionId, rowVersion: expectedVersion, series: await getBlogOwnershipScope(actor.workspaceId), status: { in: states[action] } },
      data: {
        status: action === "cancel" ? "CANCELLED" : "NEEDS_REVIEW",
        approvedRevisionId: null, rowVersion: { increment: 1 },
        ...(action === "cancel" ? { cancelledAt: now } : {}),
        ...(action === "reschedule" ? { intendedSendAt } : {}),
      },
    });
    if (claimed.count !== 1) throw new Error("NEWSLETTER_EDITION_CHANGED");
    // Lock job rows before inspecting their state. Never claim that cancellation
    // stopped a worker that already obtained its lease.
    await tx.$queryRaw`SELECT id FROM "NewsletterJob" WHERE "editionId" = ${editionId} FOR UPDATE`;
    const busy = await tx.newsletterJob.findFirst({ where: { editionId, status: "CLAIMED" }, select: { id: true } });
    if (busy) throw new Error("NEWSLETTER_EDITION_BUSY");
    await tx.newsletterApproval.updateMany({
      where: { editionId, revokedAt: null },
      data: { revokedAt: now, revocationReason: action === "reschedule" ? "The intended send schedule changed."
        : action === "cancel" ? "Administrator cancelled the edition." : "Administrator revoked approval." },
    });
    await tx.newsletterJob.updateMany({
      where: { editionId, status: "PENDING", ...(action === "cancel" ? {} : { type: "SEND" as const }) },
      data: { status: "CANCELLED", completedAt: now },
    });
  });
}
