import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processReferralCommunications } from "@/lib/referrals/delivery";
import { referralStudioEnabled } from "@/lib/referrals/config";
import { processPendingReferralLaunches } from "@/lib/referrals/launch";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function GET(request: Request) {
  const authenticated = authorized(request);
  const invocation = await prisma.referralCronInvocation.create({
    data: {
      source: request.headers.get("x-vercel-cron") ? "VERCEL_CRON" : "HTTP",
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      authenticated,
    },
  });
  if (!authenticated) {
    await prisma.referralCronInvocation.update({
      where: { id: invocation.id },
      data: { completedAt: new Date(), terminalResult: "AUTHENTICATION_REJECTED" },
    });
    return NextResponse.json({ success: false, invocationId: invocation.id }, { status: 401 });
  }
  if (!referralStudioEnabled()) return NextResponse.json({ success: true, disabled: true });
  try {
    const launches = await processPendingReferralLaunches();
    const delivery = await processReferralCommunications();
    await prisma.referralCronInvocation.update({
      where: { id: invocation.id },
      data: {
        completedAt: new Date(),
        campaignsInspected: launches.length,
        campaignsEligible: launches.filter(item => item.success).length,
        campaignsRejected: launches.filter(item => !item.success).length,
        communicationsDue: delivery.due,
        communicationsClaimed: delivery.claimed,
        communicationsSkipped: delivery.skipped,
        providerSubmissionsAttempted: delivery.sent + delivery.failed,
        providerSubmissionsAccepted: delivery.sent,
        providerSubmissionsFailed: delivery.failed,
        terminalResult: delivery.due === 0 ? "NO_DUE_COMMUNICATIONS" : delivery.sent ? "DELIVERY_ACCEPTED" : "ZERO_SEND",
      },
    });
    return NextResponse.json({ success: true, invocationId: invocation.id, launches, delivery });
  } catch (error) {
    console.error("Referral scheduler failed:", error);
    await prisma.referralCronInvocation.update({
      where: { id: invocation.id },
      data: {
        completedAt: new Date(),
        terminalResult: "FAILED",
        sanitizedError: error instanceof Error ? error.name : "UnknownError",
      },
    });
    return NextResponse.json({ success: false, invocationId: invocation.id, error: "Referral scheduling could not be completed." }, { status: 500 });
  }
}
