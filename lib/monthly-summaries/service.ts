import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { addressIsMarketingEligible, createPreferenceToken } from "@/lib/client-communications/preferences";
import { bouncedBackSystemKey } from "@/lib/client-communications/bounce-core";
import { sendEmail, EmailDeliveryError } from "@/lib/client-communications/providers/resend";
import { getSiteUrl } from "@/lib/site";
import { createSummaryReader, summaryConfiguration } from "./hdphotohub";
import { positiveId, requireCompletedMonth, summarize, TEST_EMAIL, type Summary } from "./core";
import { renderSummaryEmail, summarySubject } from "./email";
import { summaryPdfAttachment } from "./pdf";
import { prepareV1Month } from "./v1-month";
import { deliveryEnabled, failureStatus } from "./delivery-policy";

export function liveDeliveryApproved() {
  return !process.env.HDPH_API_KEY?.trim() && deliveryEnabled({ MONTHLY_SUMMARIES_LIVE_ENABLED: process.env.MONTHLY_SUMMARIES_LIVE_ENABLED, MONTHLY_SUMMARIES_DATA_APPROVED: process.env.MONTHLY_SUMMARIES_DATA_APPROVED });
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const summaryHash = (summary: Summary) => createHash("sha256").update(JSON.stringify(summary)).digest("hex");

export async function settingsFor(workspaceId: string) {
  return prisma.monthlySummarySettings.upsert({ where: { workspaceId }, create: { workspaceId }, update: {} });
}

export async function generateMonth(workspaceId: string, month: string) {
  requireCompletedMonth(month);
  const useV1 = Boolean(process.env.HDPH_API_KEY?.trim());
  if (!useV1) summaryConfiguration(workspaceId);
  await settingsFor(workspaceId);
  const generationToken = randomUUID();
  const claimed = await prisma.monthlySummarySettings.updateMany({
    where: { workspaceId, OR: [{ generationUntil: null }, { generationUntil: { lt: new Date() } }] },
    data: { generationToken, generationUntil: new Date(Date.now() + 300_000) },
  });
  if (!claimed.count) throw new Error("A monthly generation is already running. Try again when it finishes.");
  try {
    const reader = useV1 ? null : createSummaryReader(workspaceId);
    const [orders, clients, settings] = await Promise.all([
      reader ? reader.orders(month) : Promise.resolve([]),
      prisma.communicationClient.findMany({ where: { workspaceMemberships: { some: { workspaceId } } }, select: { id: true, hdPhotoHubUserId: true, normalizedEmail: true, displayName: true } }),
      settingsFor(workspaceId),
    ]);
    const byId = new Map(clients.map(client => [client.hdPhotoHubUserId, client]));
    const grouped = new Map<number, typeof orders>();
    const { start, end } = requireCompletedMonth(month);
    for (const order of orders) {
      // A malformed timestamp must reach summarize and hold the report, never disappear in a filter.
      const date = typeof order.createDate === "string" ? Date.parse(order.createDate) : NaN;
      if (Number.isFinite(date) && (date < +start || date >= +end)) continue;
      const id = positiveId(order.clientId);
      grouped.set(id, [...(grouped.get(id) || []), order]);
    }
    const exclusions = Array.isArray(settings.excludedOrderIds) ? settings.excludedOrderIds.map(positiveId) : [];
    const prepared: { clientId: string; summary: Summary }[] = useV1 ? await prepareV1Month({ month, clients, apiKey: process.env.HDPH_API_KEY! }) : [];
    for (const [id, clientOrders] of grouped) {
      const local = byId.get(id);
      if (!local) throw new Error(`Client ${id} is not linked to this workspace. Sync the client directory and regenerate; no partial month was saved.`);
      const client = await reader!.client(id);
      const summary = summarize({ month, brandId: reader!.brandId, client, orders: clientOrders, excludedOrderIds: exclusions });
      if (summary.email !== local.normalizedEmail) summary.issues.push("Client directory email differs from HDPhotoHub. Sync and review before sending.");
      prepared.push({ clientId: local.id, summary });
    }
    // Fetch and validate the complete month before persisting any new reports.
    await prisma.$transaction(async tx => {
      const lock = await tx.monthlySummarySettings.findFirst({ where: { workspaceId, generationToken, generationUntil: { gt: new Date() } } });
      if (!lock) throw new Error("Generation expired. Retry; no partial month was saved.");
      for (const { clientId, summary } of prepared) {
        const key = { workspaceId, hdPhotoHubClientId: summary.clientId, reportingMonth: month };
        const existing = await tx.monthlyMediaSummary.findUnique({ where: { workspaceId_hdPhotoHubClientId_reportingMonth: key } });
        if (existing && ["SENDING", "ACCEPTED", "UNCERTAIN"].includes(existing.status)) continue;
        const status = summary.issues.length || (summary.source === "v1-review" && summary.orderCount) ? "NEEDS_REVIEW" : summary.orderCount ? "READY" : "NO_PURCHASES";
        const data = { clientId, recipientEmail: summary.email, snapshot: json(summary), contentHash: summaryHash(summary), generatedAt: new Date(), status };
        if (existing) {
          await tx.monthlyMediaSummary.updateMany({ where: { id: existing.id, status: { in: ["READY", "NEEDS_REVIEW", "NO_PURCHASES", "FAILED", "SUPPRESSED"] } }, data });
        } else await tx.monthlyMediaSummary.create({ data: { ...key, ...data } });
      }
      // A removed order must not leave an old unsent report ready to send.
      await tx.monthlyMediaSummary.updateMany({
        where: { workspaceId, reportingMonth: month, hdPhotoHubClientId: { notIn: prepared.map(p => p.summary.clientId) }, status: { in: ["READY", "NEEDS_REVIEW", "NO_PURCHASES", "FAILED", "SUPPRESSED"] } },
        data: { status: "NO_PURCHASES" },
      });
    }, { timeout: 30_000 });
    return { generated: prepared.filter(p => p.summary.orderCount || p.summary.issues.length).length, checked: prepared.length, ready: prepared.filter(p => p.summary.source !== "v1-review" && !p.summary.issues.length && p.summary.orderCount).length, review: prepared.filter(p => p.summary.issues.length || (p.summary.source === "v1-review" && p.summary.orderCount)).length };
  } finally {
    await prisma.monthlySummarySettings.updateMany({ where: { workspaceId, generationToken }, data: { generationToken: null, generationUntil: null } });
  }
}

export async function reportFor(workspaceId: string, reportId: string) {
  const report = await prisma.monthlyMediaSummary.findFirst({ where: { id: reportId, workspaceId }, include: { client: { include: { workspaceMemberships: true, groupMemberships: { include: { group: true } } } }, attempts: { orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!report || !report.client.workspaceMemberships.some(m => m.workspaceId === workspaceId)) throw new Error("Report not found in this workspace.");
  const summary = report.snapshot as unknown as Summary;
  if (summaryHash(summary) !== report.contentHash || summary.clientId !== report.hdPhotoHubClientId || summary.month !== report.reportingMonth || summary.email !== report.recipientEmail) throw new Error("Report snapshot failed validation. Regenerate before sending.");
  return { report, summary };
}

export async function sendReport(workspaceId: string, reportId: string, kind: "TEST" | "LIVE" | "RESEND", requestId: string) {
  if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new Error("Invalid delivery request ID.");
  const { report, summary } = await reportFor(workspaceId, reportId);
  if (summary.issues.length || !summary.orderCount || !(kind === "TEST" ? ["READY", "FAILED", "ACCEPTED", "NEEDS_REVIEW"] : ["READY", "FAILED", "ACCEPTED"]).includes(report.status)) throw new Error("This report is not ready to send.");
  if (kind !== "TEST") {
    if (summary.source === "v1-review") throw new Error("These v1 drafts are for internal review only. Client delivery is not enabled.");
    if (!liveDeliveryApproved()) throw new Error("Live delivery is locked pending data and rollout approval.");
    const settings = await settingsFor(workspaceId);
    if (!settings.automationEnabled || (settings.generationUntil && settings.generationUntil > new Date())) throw new Error("Automation is paused or generation is still running.");
    if (kind === "LIVE" && report.generatedAt < new Date(Date.now() - 24 * 60 * 60_000)) throw new Error("Report is stale. Regenerate before sending.");
    const freshClient = await createSummaryReader(workspaceId).client(summary.clientId);
    if (String(freshClient.email).trim().toLowerCase() !== summary.email || freshClient.status !== "active") throw new Error("Client account changed. Regenerate and review before sending.");
    const client = report.client;
    const suppressed = client.archivedAt || !client.emailSubscribed || client.emailStatus !== "VALID" || client.normalizedEmail !== summary.email || client.groupMemberships.some(m => m.group.systemKey === bouncedBackSystemKey(workspaceId)) || !(await addressIsMarketingEligible(summary.email));
    if (suppressed) {
      await prisma.monthlyMediaSummary.updateMany({ where: { id: report.id, workspaceId, status: { in: ["READY", "FAILED"] } }, data: { status: "SUPPRESSED" } });
      throw new Error("Recipient is unsubscribed, suppressed, or no longer matches the report.");
    }
  }
  if (kind === "RESEND" && !report.acceptedAt) throw new Error("Only a previously sent report can be resent.");
  const to = kind === "TEST" ? TEST_EMAIL : summary.email;
  const requestKey = kind === "LIVE" ? `monthly/${report.id}/${report.contentHash}` : `monthly-${kind.toLowerCase()}/${report.id}/${requestId}`;
  const existing = await prisma.monthlySummaryAttempt.findUnique({ where: { requestKey } });
  if (existing?.status === "ACCEPTED") return { messageId: existing.providerMessageId, repeated: true };
  if (existing && existing.status !== "FAILED") throw new Error("This delivery is in progress or uncertain. Check Resend before trying again.");
  type Payload = { attachments?: { filename: string; content: string; contentType: string }[]; to: string; subject: string; html: string; unsubscribeUrl?: string; from?: string; replyTo?: string };
  let payload: Payload;
  if (existing) {
    payload = existing.payload as unknown as Payload;
    if (payload.to !== to) throw new Error("The recipient changed. Review before retrying.");
  } else {
    const unsubscribeToken = kind !== "TEST" ? await createPreferenceToken({ clientId: report.clientId }) : null;
    const unsubscribeUrl = unsubscribeToken ? `${getSiteUrl()}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}` : undefined;
    payload = { attachments: [await summaryPdfAttachment(summary)], to, subject: `${kind === "TEST" ? "[TEST] " : ""}${summarySubject(summary.month)}`, html: renderSummaryEmail(summary, { unsubscribeUrl }), unsubscribeUrl,
      from: process.env.CAMPAIGN_EMAIL_FROM || process.env.PORTAL_EMAIL_FROM, replyTo: process.env.CAMPAIGN_REPLY_TO };
  }
  const attempt = await prisma.$transaction(async tx => {
    if (kind !== "TEST") {
      const statuses = kind === "RESEND" ? ["ACCEPTED", "FAILED"] : ["READY", "FAILED"];
      const claimed = await tx.monthlyMediaSummary.updateMany({ where: { id: report.id, workspaceId, status: { in: statuses }, contentHash: report.contentHash }, data: { status: "SENDING" } });
      if (!claimed.count) throw new Error("Report was already claimed or changed. Refresh its status.");
    }
    if (existing) {
      const claimed = await tx.monthlySummaryAttempt.updateMany({ where: { id: existing.id, status: "FAILED" }, data: { status: "SENDING", error: null, completedAt: null, attemptCount: { increment: 1 } } });
      if (!claimed.count) throw new Error("This retry was already claimed.");
      return existing;
    }
    return tx.monthlySummaryAttempt.create({ data: { reportId: report.id, requestKey, payload: json(payload), kind, recipientEmail: to } });
  });
  let acceptedMessageId: string | null = null;
  try {
    const result = await sendEmail({ ...payload, source: "monthly-summary", operationId: attempt.id, idempotencyKey: requestKey, singleAttempt: true });
    acceptedMessageId = result.messageId;
    await prisma.$transaction([
      prisma.monthlySummaryAttempt.update({ where: { id: attempt.id }, data: { status: "ACCEPTED", providerMessageId: result.messageId, completedAt: new Date() } }),
      ...(kind !== "TEST" ? [prisma.monthlyMediaSummary.update({ where: { id: report.id }, data: { status: "ACCEPTED", acceptedAt: report.acceptedAt || new Date() } })] : []),
    ]);
    return { messageId: result.messageId, repeated: false };
  } catch (error) {
    // One provider request only: explicit rejection is retryable; ambiguous outcomes are held.
    const status = failureStatus(error instanceof EmailDeliveryError ? error : null);
    const definite = status === "FAILED";
    const message = definite ? "Resend rejected this request. Correct configuration or rate limits, then retry." : "Delivery was not confirmed. Check Resend before any new attempt.";
    await prisma.$transaction([
      prisma.monthlySummaryAttempt.update({ where: { id: attempt.id }, data: { status, error: message, providerMessageId: acceptedMessageId, completedAt: new Date() } }),
      ...(kind !== "TEST" ? [prisma.monthlyMediaSummary.update({ where: { id: report.id }, data: { status: definite && report.acceptedAt ? "ACCEPTED" : status } })] : []),
    ]);
    throw new Error(message);
  }
}

export async function retryAttempt(workspaceId: string, reportId: string, attemptId: string) {
  const { report } = await reportFor(workspaceId, reportId);
  const attempt = await prisma.monthlySummaryAttempt.findFirst({ where: { id: attemptId, reportId: report.id, status: "FAILED" } });
  if (!attempt) throw new Error("Only a confirmed failed attempt can be retried. Uncertain sends require review.");
  const kind = attempt.kind as "TEST" | "LIVE" | "RESEND";
  return sendReport(workspaceId, reportId, kind, kind === "LIVE" ? randomUUID() : attempt.requestKey.split("/").at(-1)!);
}
