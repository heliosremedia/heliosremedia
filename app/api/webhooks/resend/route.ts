import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setMarketingPreference } from "@/lib/client-communications/preferences";
import { processPermanentBounce } from "@/lib/client-communications/bounces";
import {
  diagnosticEmails,
  normalizedResendStatus,
  safeEventDate,
} from "@/lib/client-communications/resend-webhook-core";

export const dynamic = "force-dynamic";

function verifyWebhook(rawBody: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1_000 - seconds) > 300) return false;
  try {
    const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
    const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
    return signatures.split(" ").some((signature) => {
      const [version, encoded] = signature.split(",");
      if (version !== "v1" || !encoded) return false;
      const received = Buffer.from(encoded, "base64");
      return received.length === expected.length && timingSafeEqual(received, expected);
    });
  } catch {
    return false;
  }
}

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: unknown;
    tags?: unknown;
    click?: { link?: string };
    bounce?: { type?: string; subtype?: string; message?: string };
  };
};

function diagnosticCampaignId(tags: unknown) {
  if (Array.isArray(tags)) {
    const tag = tags.find((item) => item && typeof item === "object" &&
      "name" in item && item.name === "campaign_id" && "value" in item);
    return tag && typeof tag === "object" && "value" in tag && typeof tag.value === "string"
      ? tag.value : null;
  }
  if (tags && typeof tags === "object" && "campaign_id" in tags) {
    const value = (tags as { campaign_id?: unknown }).campaign_id;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function safeReject(reason: string, request: Request) {
  console.warn("Resend webhook rejected", {
    reason,
    providerEventId: request.headers.get("svix-id") || "missing",
  });
}

export async function POST(request: Request) {
  const receivedAt = new Date();
  const rawBody = await request.text();
  const providerEventId = request.headers.get("svix-id");
  if (!verifyWebhook(rawBody, request.headers) || !providerEventId) {
    safeReject("signature_verification_failed", request);
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    safeReject("invalid_json", request);
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const normalizedStatus = normalizedResendStatus(event.type);
  if (!normalizedStatus) {
    return NextResponse.json({ success: true, ignored: true });
  }
  const providerMessageId = event.data?.email_id?.trim() || null;
  const occurredAt = safeEventDate(event.created_at, receivedAt);

  try {
    const existing = await prisma.resendWebhookEvent.findUnique({
      where: { providerEventId },
      select: { processingStatus: true },
    });
    if (existing && existing.processingStatus !== "FAILED_RETRYABLE") {
      return NextResponse.json({ success: true, duplicate: true });
    }

    if (existing) {
      await prisma.resendWebhookEvent.update({
        where: { providerEventId },
        data: { processingStatus: "PROCESSING", reason: null, processedAt: null },
      });
    } else {
      await prisma.resendWebhookEvent.create({
        data: {
          providerEventId,
          providerMessageId,
          eventType: event.type!,
          normalizedStatus,
          processingStatus: "PROCESSING",
          occurredAt,
          receivedAt,
        },
      });
    }

    const matches = providerMessageId ? await prisma.campaignRecipient.findMany({
      where: { providerMessageId },
      take: 2,
      select: {
        id: true,
        clientId: true,
        email: true,
        campaign: { select: { createdBy: { select: { workspaceId: true } } } },
      },
    }) : [];
    const referralCommunication = matches.length === 0 && providerMessageId
      ? await prisma.referralCommunication.findFirst({
        where: { providerMessageId },
        select: {
          id: true,
          invitationId: true,
          campaignId: true,
          submissionId: true,
          campaign: { select: { createdBy: { select: { workspaceId: true } } } },
        },
      })
      : null;
    if (referralCommunication) {
      const referralStatus = {
        SENT: "SENT",
        DELIVERED: "DELIVERED",
        DELAYED: "SENT",
        OPENED: "OPENED",
        CLICKED: "CLICKED",
        BOUNCED: "FAILED",
        FAILED: "FAILED",
        SUPPRESSED: "FAILED",
        COMPLAINED: "UNSUBSCRIBED",
      }[normalizedStatus] as "SENT" | "DELIVERED" | "OPENED" | "CLICKED" | "FAILED" | "UNSUBSCRIBED";
      await prisma.$transaction([
        prisma.referralCommunication.update({
          where: { id: referralCommunication.id },
          data: {
            status: referralStatus,
            failureCode: referralStatus === "FAILED" ? `PROVIDER_${normalizedStatus}` : null,
          },
        }),
        ...(referralCommunication.invitationId ? [prisma.referralInvitation.update({
          where: { id: referralCommunication.invitationId },
          data: { status: referralStatus },
        })] : []),
        prisma.referralAuditEvent.create({
          data: {
            campaignId: referralCommunication.campaignId,
            submissionId: referralCommunication.submissionId,
            action: `COMMUNICATION_${referralStatus}`,
            summary: `Referral communication marked ${referralStatus.toLowerCase()}.`,
            metadata: { communicationId: referralCommunication.id, providerEventId },
          },
        }),
        prisma.resendWebhookEvent.update({
          where: { providerEventId },
          data: {
            workspaceId: referralCommunication.campaign.createdBy.workspaceId,
            processingStatus: "PROCESSED",
            processedAt: new Date(),
          },
        }),
      ]);
      return NextResponse.json({ success: true, matched: true });
    }
    if (matches.length !== 1) {
      const diagnosticEmail = diagnosticEmails(event.data?.to)[0] || null;
      const campaignId = diagnosticCampaignId(event.data?.tags);
      const diagnosticCampaign = campaignId ? await prisma.emailCampaign.findUnique({
        where: { id: campaignId },
        select: { createdBy: { select: { workspaceId: true } } },
      }) : null;
      await prisma.resendWebhookEvent.update({
        where: { providerEventId },
        data: {
          normalizedEmail: diagnosticEmail,
          workspaceId: diagnosticCampaign?.createdBy.workspaceId,
          processingStatus: providerMessageId
            ? matches.length ? "UNMATCHED_AMBIGUOUS_MESSAGE_ID" : "UNMATCHED_MESSAGE_ID"
            : "UNMATCHED_MISSING_MESSAGE_ID",
          reason: "Retained for diagnostic reconciliation; recipient email and campaign tags are not used as the primary relationship.",
          processedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, matched: false });
    }

    const recipient = matches[0];
    await prisma.$transaction([
      prisma.campaignDeliveryEvent.upsert({
        where: { providerEventId },
        create: {
          providerEventId,
          providerMessageId: providerMessageId!,
          campaignRecipientId: recipient.id,
          providerEventType: event.type!,
          eventType: normalizedStatus,
          normalizedStatus,
          linkUrl: event.data?.click?.link || null,
          occurredAt,
          receivedAt,
          processedAt: new Date(),
        },
        update: {},
      }),
      prisma.resendWebhookEvent.update({
        where: { providerEventId },
        data: {
          workspaceId: recipient.campaign.createdBy.workspaceId,
          clientId: recipient.clientId,
          campaignRecipientId: recipient.id,
          normalizedEmail: recipient.email.trim().toLowerCase(),
          processingStatus: "PROCESSED",
          processedAt: new Date(),
        },
      }),
    ]);

    if (event.type === "email.bounced") {
      await processPermanentBounce(providerEventId, event, true);
    }
    if (event.type === "email.complained") {
      const email = recipient.email.trim().toLowerCase();
      const suppressionId = `${providerMessageId}:${email}:COMPLAINT`;
      await prisma.$transaction([
        prisma.communicationClient.updateMany({
          where: { normalizedEmail: email },
          data: { emailStatus: "COMPLAINED", emailStatusUpdatedAt: new Date() },
        }),
        prisma.communicationSuppression.upsert({
          where: { providerEventId: suppressionId },
          create: {
            normalizedEmail: email,
            reason: "COMPLAINT",
            provider: "RESEND",
            providerEventId: suppressionId,
            clientId: recipient.clientId,
          },
          update: { releasedAt: null, reason: "COMPLAINT", clientId: recipient.clientId },
        }),
      ]);
      await setMarketingPreference({
        email,
        status: "UNSUBSCRIBED",
        source: "RESEND_WEBHOOK",
        reason: "COMPLAINT",
        messageId: providerMessageId || undefined,
      });
    }
    return NextResponse.json({ success: true, matched: true });
  } catch (error) {
    await prisma.resendWebhookEvent.updateMany({
      where: { providerEventId },
      data: {
        processingStatus: "FAILED_RETRYABLE",
        reason: error instanceof Error ? error.name.slice(0, 120) : "UnknownError",
        processedAt: new Date(),
      },
    }).catch(() => undefined);
    console.error("Unable to process Resend delivery event", {
      providerEventId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ success: false }, { status: 503 });
  }
}
