import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { accountCheckFailed } from "@/lib/monthly-summaries/review-status";
import type { Summary } from "@/lib/monthly-summaries/core";
import { useLegacySummaryReader } from "@/lib/monthly-summaries/reader-policy";
import { connectionStatus } from "@/lib/monthly-summaries/hdphotohub";
import { generateMonth, liveDeliveryApproved, reportFor, sendReport, settingsFor, retryAttempt } from "@/lib/monthly-summaries/service";
import { previousMonth, requireCompletedMonth, TEST_EMAIL } from "@/lib/monthly-summaries/core";
import { renderSummaryEmail, sampleSummary } from "@/lib/monthly-summaries/email";
import { renderSummaryPdf } from "@/lib/monthly-summaries/pdf";
import { recordAuditEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function authorized() {
  const session = await getAdminSession();
  return session && ["OWNER", "ADMIN"].includes(session.role) ? session : null;
}
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request) {
  const session = await authorized();
  if (!session) return response({ error: "Owner or administrator access is required." }, 403);
  try {
    const url = new URL(request.url);
    const month = url.searchParams.get("month") || previousMonth();
    requireCompletedMonth(month);
    const wantsPdf = url.searchParams.get("format") === "pdf";
    const pdfResponse = async (summary: Parameters<typeof renderSummaryPdf>[0], sample = false) => new Response(new Uint8Array(await renderSummaryPdf(summary, { sample })), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Helios-Media-Summary-${summary.month}${sample ? "-Sample" : ""}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
    if (url.searchParams.get("sample") === "true" && wantsPdf) return await pdfResponse(sampleSummary(month), true);
    if (url.searchParams.get("sample") === "true") return response({ html: renderSummaryEmail(sampleSummary(month), { sample: true }), sample: true });
    const reportId = url.searchParams.get("reportId");
    if (reportId) {
      const { report, summary } = await reportFor(session.workspaceId, reportId);
      if (wantsPdf) {
        if (summary.issues.length || !summary.orderCount || report.status === "NO_PURCHASES") return response({ error: "This report has no purchases. Regenerate before downloading." }, 409);
        return await pdfResponse(summary);
      }
      return response({ summary, html: !summary.issues.length && summary.orderCount && report.status !== "NO_PURCHASES" ? renderSummaryEmail(summary) : null, history: report.attempts.map(a => ({ id: a.id, kind: a.kind, status: a.status, recipientEmail: a.recipientEmail, createdAt: a.createdAt, providerMessageId: a.providerMessageId, error: a.error, attemptCount: a.attemptCount })) });
    }
    const [settings, reports] = await Promise.all([
      settingsFor(session.workspaceId),
      prisma.monthlyMediaSummary.findMany({ where: { workspaceId: session.workspaceId, reportingMonth: month }, orderBy: { client: { displayName: "asc" } }, select: { snapshot: true, id: true, recipientEmail: true, status: true, generatedAt: true, acceptedAt: true, client: { select: { displayName: true } } } }),
    ]);
    return response({ reports: reports.map(({ snapshot, ...report }) => ({ ...report, status: report.status === "NEEDS_REVIEW" && accountCheckFailed(snapshot as unknown as Summary) ? "CHECK_FAILED" : report.status })), settings: { automationEnabled: settings.automationEnabled, liveApproved: liveDeliveryApproved(), connected: useLegacySummaryReader(process.env) || (connectionStatus() && process.env.HDPH_SUMMARY_WORKSPACE_ID === session.workspaceId), reviewMode: useLegacySummaryReader(process.env), testEmail: TEST_EMAIL, sender: process.env.CAMPAIGN_EMAIL_FROM || process.env.PORTAL_EMAIL_FROM || "Sender not configured" } });
  } catch (error) { return response({ error: error instanceof Error ? error.message : "Monthly summaries could not be loaded." }, 400); }
}
export async function POST(request: Request) {
  const session = await authorized();
  if (!session) return response({ error: "Owner or administrator access is required." }, 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return response({ error: "Request origin is not allowed." }, 403);
  try {
    const input = await request.json();
    if (input.action === "generate") {
      if (typeof input.month !== "string") return response({ error: "Select a reporting month." }, 400);
      const result = await generateMonth(session.workspaceId, input.month, undefined, typeof input.afterClientId === "string" ? input.afterClientId : undefined);
      await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "MONTHLY_SUMMARIES_GENERATED", entityType: "MonthlyMediaSummary", summary: `Generated ${input.month} monthly summaries.`, metadata: result });
      return response({ ...result, message: `${result.checked} accounts checked; ${result.generated} purchase summaries; ${result.checkFailed} account checks failed; ${result.noPurchases} with no purchases. No emails were sent.` });
    }
    if (input.action === "recheck") {
      if (typeof input.reportId !== "string") return response({ error: "Select an account to check." }, 400);
      const { report } = await reportFor(session.workspaceId, input.reportId);
      if (!["CHECK_FAILED", "NEEDS_REVIEW", "NO_PURCHASES"].includes(report.status)) return response({ error: "This report is not awaiting an account check." }, 409);
      const result = await generateMonth(session.workspaceId, report.reportingMonth, report.clientId);
      return response({ ...result, message: result.checkFailed ? "Account check failed. The specific reason is shown below." : "Account check completed. Review the updated result below. No email was sent." });
    }
    if (input.action === "test") {
      if (typeof input.reportId !== "string" || typeof input.requestId !== "string") return response({ error: "Select a report to test." }, 400);
      const result = await sendReport(session.workspaceId, input.reportId, "TEST", input.requestId);
      await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "MONTHLY_SUMMARY_TEST", entityType: "MonthlyMediaSummary", entityId: input.reportId, summary: `Monthly summary test accepted by Resend for ${TEST_EMAIL}.`, metadata: result });
      return response({ ...result, message: `Test accepted by Resend for ${TEST_EMAIL}.` });
    }
    if (input.action === "send") {
      if (typeof input.reportId !== "string" || typeof input.requestId !== "string" || input.confirmSend !== true) return response({ error: "Confirm the recipient and reporting month." }, 400);
      const result = await sendReport(session.workspaceId, input.reportId, "MANUAL", input.requestId);
      await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "MONTHLY_SUMMARY_MANUAL_SEND", entityType: "MonthlyMediaSummary", entityId: input.reportId, summary: "Manual monthly summary accepted by Resend.", metadata: result });
      return response({ ...result, message: "Delivery accepted by Resend." });
    }
    if (input.action === "retry" || input.action === "resend") {
      if (typeof input.reportId !== "string") return response({ error: "Select a report." }, 400);
      let result;
      if (input.action === "retry") {
        if (typeof input.attemptId !== "string") return response({ error: "Select a failed attempt." }, 400);
        result = await retryAttempt(session.workspaceId, input.reportId, input.attemptId);
      } else {
        if (input.confirmResend !== true || typeof input.requestId !== "string") return response({ error: "Confirm this manual resend." }, 400);
        result = await sendReport(session.workspaceId, input.reportId, "RESEND", input.requestId);
      }
      await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "MONTHLY_SUMMARY_DELIVERY_ACTION", entityType: "MonthlyMediaSummary", entityId: input.reportId, summary: `Monthly summary ${input.action} accepted by Resend.`, metadata: result });
      return response({ ...result, message: "Delivery accepted by Resend." });
    }
    if (input.action === "settings") {
      if (typeof input.automationEnabled !== "boolean") return response({ error: "Choose enabled or paused." }, 400);
      if (input.automationEnabled && (!liveDeliveryApproved() || !connectionStatus() || process.env.HDPH_SUMMARY_WORKSPACE_ID !== session.workspaceId)) return response({ error: "Live automation remains locked until data, design, and rollout are approved." }, 409);
      await prisma.monthlySummarySettings.upsert({ where: { workspaceId: session.workspaceId }, create: { workspaceId: session.workspaceId, automationEnabled: input.automationEnabled }, update: { automationEnabled: input.automationEnabled } });
      await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "MONTHLY_SUMMARY_AUTOMATION_CHANGED", entityType: "MonthlySummarySettings", summary: input.automationEnabled ? "Monthly automation enabled." : "Monthly automation paused." });
      return response({ message: input.automationEnabled ? "Automation enabled." : "Automation paused." });
    }
    return response({ error: "Unsupported monthly summary action." }, 400);
  } catch (error) { return response({ error: error instanceof Error ? error.message : "Monthly summary action failed." }, 400); }
}
