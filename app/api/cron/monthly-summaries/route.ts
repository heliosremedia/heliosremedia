import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateMonth, liveDeliveryApproved, sendReport } from "@/lib/monthly-summaries/service";
import { previousMonth, scheduledAt } from "@/lib/monthly-summaries/core";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ success: false }, { status: 401 });
  const workspaceId = process.env.HDPH_SUMMARY_WORKSPACE_ID;
  if (!workspaceId || !liveDeliveryApproved()) return NextResponse.json({ skipped: "Live monthly delivery is locked." });
  const settings = await prisma.monthlySummarySettings.findUnique({ where: { workspaceId } });
  if (!settings?.automationEnabled) return NextResponse.json({ skipped: "Automation is paused." });
  const month = previousMonth();
  if (new Date() < scheduledAt(month)) return NextResponse.json({ skipped: "Not due yet." });
  const started = Date.now();
  try {
    await generateMonth(workspaceId, month);
    const reports = await prisma.monthlyMediaSummary.findMany({ where: { workspaceId, reportingMonth: month, status: "READY" }, select: { id: true }, take: 100 });
    let accepted = 0;
    let held = 0;
    for (const report of reports) {
      if (Date.now() - started > 260_000) break;
      try { await sendReport(workspaceId, report.id, "LIVE", randomUUID()); accepted++; }
      catch { held++; }
    }
    return NextResponse.json({ month, accepted, held });
  } catch {
    return NextResponse.json({ success: false, error: "Monthly generation did not complete. Check connection and review reports; no partial month was sent." }, { status: 503 });
  }
}
