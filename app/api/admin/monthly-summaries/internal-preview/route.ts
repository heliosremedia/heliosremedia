import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { checkExistingConnection, VerificationError } from "@/lib/monthly-summaries/v1-check";
import { buildV1Preview, PreviewValidationError } from "@/lib/monthly-summaries/v1-preview";
import { renderSummaryEmail, summarySubject } from "@/lib/monthly-summaries/email";
import { summaryPdfAttachment } from "@/lib/monthly-summaries/pdf";
import { signPreview, verifyPreview } from "@/lib/monthly-summaries/preview-token";
import { TEST_EMAIL } from "@/lib/monthly-summaries/core";
import { sendEmail } from "@/lib/client-communications/providers/resend";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getAdminSession();
  if (!session || session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403, headers });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  let sending = false;
  try {
    const input = await request.json();
    if (input.action === "test") {
      if (typeof input.token !== "string") throw new Error("Generate a preview first.");
      const payload = verifyPreview(input.token, process.env.AUTH_SECRET || "", session.workspaceId, session.userId);
      sending = true;
      const result = await sendEmail({ to: TEST_EMAIL, subject: `[INTERNAL TEST] ${payload.subject}`, html: payload.html,
        attachments: [payload.attachment], source: "monthly-summary", operationId: payload.requestId,
        idempotencyKey: `monthly-v1-test/${payload.requestId}`, singleAttempt: true });
      return NextResponse.json({ message: `Email and PDF accepted by Resend for ${TEST_EMAIL}.`, messageId: result.messageId }, { headers });
    }
    if (input.action !== "preview" || typeof input.clientName !== "string" || typeof input.month !== "string" || typeof input.expectedTotalCents !== "number") return NextResponse.json({ error: "Enter the client, month and expected total." }, { status: 400, headers });
    const result = await checkExistingConnection({ apiKey: process.env.HDPH_API_KEY || "", clientName: input.clientName, month: input.month, expectedTotalCents: input.expectedTotalCents,
      authorizeClient: async id => Boolean(await prisma.communicationClient.findFirst({ where: { hdPhotoHubUserId: id, workspaceMemberships: { some: { workspaceId: session.workspaceId } } }, select: { id: true } })) });
    const summary = buildV1Preview(result);
    const html = renderSummaryEmail(summary);
    const attachment = await summaryPdfAttachment(summary);
    const token = signPreview({ workspaceId: session.workspaceId, userId: session.userId, expiresAt: Date.now() + 30 * 60_000, requestId: randomUUID(), subject: summarySubject(summary.month), html, attachment }, process.env.AUTH_SECRET || "");
    return NextResponse.json({ html, pdf: attachment.content, filename: attachment.filename, token, notes: result.notes }, { headers });
  } catch (error) {
    const message = sending ? "Delivery was not confirmed. Check Resend before starting another test; do not generate a replacement preview to retry." : error instanceof VerificationError || error instanceof PreviewValidationError ? error.message : "The internal preview could not be prepared. Check matching totals, charged services, and review flags.";
    return NextResponse.json({ error: message, uncertain: sending }, { status: 400, headers });
  }
}
