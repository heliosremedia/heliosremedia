import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";

const clean = (value: unknown, max = 100) => typeof value === "string" ? value.trim().slice(0, max) : "";
export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const jobId = clean(body.jobId);
  const action = clean(body.action);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const access = await requireLockedWorkspaceEditor(tx, session);
      if (!["OWNER", "ADMIN"].includes(access.role)) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
      await tx.$queryRaw`SELECT j.id FROM "SocialPublishingJob" j JOIN "SocialVariant" v ON v.id=j."variantId" JOIN "SocialCampaign" c ON c.id=v."campaignId" WHERE j.id=${jobId} AND c."workspaceId"=${session.workspaceId} FOR UPDATE OF j`;
      const job = await tx.socialPublishingJob.findFirst({ where: { id: jobId, connection: { workspaceId: session.workspaceId }, variant: { campaign: { workspaceId: session.workspaceId } } } });
      if (!job) return { error: "Publishing job not found.", status: 404 };
      if (job.claimToken || ["VALIDATING", "PUBLISHING", "PROVIDER_PROCESSING", "PUBLISHED"].includes(job.status)) return { error: "Resolve the current publication before changing this job.", status: 409 };
      const where = { id: job.id, status: job.status, claimToken: null, connection: { workspaceId: session.workspaceId }, variant: { campaign: { workspaceId: session.workspaceId } } };
      let changed: { count: number };
      let status: string;
      if (action === "retry" && ["FAILED", "RETRY_SCHEDULED", "DELAYED"].includes(job.status)) {
        changed = await tx.socialPublishingJob.updateMany({ where, data: { status: "RETRY_SCHEDULED", nextAttemptAt: new Date() } });
        status = "RETRY_SCHEDULED";
      } else if (action === "cancel" && ["SCHEDULED", "RETRY_SCHEDULED", "DELAYED"].includes(job.status)) {
        changed = await tx.socialPublishingJob.updateMany({ where, data: { status: "CANCELLED", cancelledAt: new Date(), lastErrorCategory: "CANCELLED", lastErrorMessage: "Cancelled by an administrator." } });
        status = "CANCELLED";
      } else if (action === "manual-fallback") {
        changed = await tx.socialPublishingJob.updateMany({ where, data: { status: "MANUAL_FALLBACK", lastErrorMessage: "Moved to the manual publishing workflow by an administrator." } });
        status = "MANUAL_FALLBACK";
      } else return { error: "That action is unsafe for the current job state.", status: 409 };
      return changed.count === 1 ? { jobStatus: status } : { error: "The publishing job changed. Refresh and try again.", status: 409 };
    });
    if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, status: result.jobStatus });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
    return NextResponse.json({ success: false, error: "The publishing job could not be changed." }, { status: 500 });
  }
}
