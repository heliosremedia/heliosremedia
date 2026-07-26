import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "./normalization";

export const UNSUBSCRIBED_GROUP_KEY = "MARKETING_UNSUBSCRIBED";
export const UNSUBSCRIBED_GROUP_NAME = "Unsubscribed";
export { hashPreferenceToken, marketingStatusAllowsSend, MARKETING_TOKEN_TTL_DAYS } from "./preference-rules";
import { hashPreferenceToken, marketingStatusAllowsSend, MARKETING_TOKEN_TTL_DAYS, validPreferenceTokenFormat } from "./preference-rules";

export function generatePreferenceToken() {
  return randomBytes(32).toString("base64url");
}

async function systemGroup(transaction = prisma) {
  return transaction.communicationGroup.upsert({
    where: { systemKey: UNSUBSCRIBED_GROUP_KEY },
    create: {
      name: UNSUBSCRIBED_GROUP_NAME,
      normalizedName: UNSUBSCRIBED_GROUP_NAME.toLowerCase(),
      systemKey: UNSUBSCRIBED_GROUP_KEY,
      systemManaged: true,
    },
    update: {
      name: UNSUBSCRIBED_GROUP_NAME,
      normalizedName: UNSUBSCRIBED_GROUP_NAME.toLowerCase(),
      systemManaged: true,
    },
    select: { id: true },
  });
}

export async function reconcileUnsubscribedGroup(normalizedEmail: string) {
  const preference = await prisma.marketingEmailPreference.findUnique({
    where: { normalizedEmail },
    select: { status: true },
  });
  const clients = await prisma.communicationClient.findMany({
    where: { normalizedEmail },
    select: { id: true },
  });
  const group = await systemGroup();
  if (preference && ["UNSUBSCRIBED", "SUPPRESSED"].includes(preference.status)) {
    await prisma.communicationGroupMembership.createMany({
      data: clients.map((client) => ({ groupId: group.id, clientId: client.id })),
      skipDuplicates: true,
    });
  } else {
    await prisma.communicationGroupMembership.deleteMany({
      where: { groupId: group.id, clientId: { in: clients.map((client) => client.id) } },
    });
  }
}

export async function setMarketingPreference(input: {
  email: string;
  status: "SUBSCRIBED" | "UNSUBSCRIBED" | "SUPPRESSED" | "PENDING_CONFIRMATION" | "UNKNOWN";
  source: string;
  reason?: string | null;
  campaignId?: string | null;
  messageId?: string | null;
  actorId?: string | null;
  resubscribeMethod?: string | null;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) throw new Error("A valid email address is required.");
  const now = new Date();
  const existing = await prisma.marketingEmailPreference.findUnique({
    where: { normalizedEmail },
    select: { id: true, status: true },
  });
  const preference = await prisma.$transaction(async (transaction) => {
    const next = await transaction.marketingEmailPreference.upsert({
      where: { normalizedEmail },
      create: {
        normalizedEmail,
        status: input.status,
        effectiveAt: now,
        source: input.source,
        reason: input.reason,
        campaignId: input.campaignId,
        messageId: input.messageId,
        actingAdminId: input.actorId,
        resubscribedAt: input.status === "SUBSCRIBED" ? now : null,
        resubscribeMethod: input.status === "SUBSCRIBED" ? input.resubscribeMethod : null,
      },
      update: {
        status: input.status,
        effectiveAt: now,
        source: input.source,
        reason: input.reason,
        campaignId: input.campaignId,
        messageId: input.messageId,
        actingAdminId: input.actorId,
        resubscribedAt: input.status === "SUBSCRIBED" ? now : undefined,
        resubscribeMethod: input.status === "SUBSCRIBED" ? input.resubscribeMethod : undefined,
      },
    });
    await transaction.marketingEmailPreferenceEvent.create({
      data: {
        preferenceId: next.id,
        previousStatus: existing?.status,
        status: input.status,
        source: input.source,
        reason: input.reason,
        campaignId: input.campaignId,
        messageId: input.messageId,
        actorId: input.actorId,
      },
    });
    await transaction.communicationClient.updateMany({
      where: { normalizedEmail },
      data: {
        emailSubscribed: input.status === "SUBSCRIBED",
        unsubscribedAt: ["UNSUBSCRIBED", "SUPPRESSED"].includes(input.status) ? now : null,
      },
    });
    return next;
  });
  await reconcileUnsubscribedGroup(normalizedEmail);
  return preference;
}

export async function createPreferenceToken(input: {
  clientId: string;
  campaignId?: string | null;
  messageId?: string | null;
}) {
  const client = await prisma.communicationClient.findUnique({
    where: { id: input.clientId },
    select: { normalizedEmail: true },
  });
  if (!client?.normalizedEmail) throw new Error("Recipient preference record is unavailable.");
  const preference = await prisma.marketingEmailPreference.upsert({
    where: { normalizedEmail: client.normalizedEmail },
    create: { normalizedEmail: client.normalizedEmail, status: "UNKNOWN", source: "LEGACY_CLIENT" },
    update: {},
  });
  const token = generatePreferenceToken();
  await prisma.marketingEmailPreferenceToken.create({
    data: {
      preferenceId: preference.id,
      tokenHash: hashPreferenceToken(token),
      expiresAt: new Date(Date.now() + MARKETING_TOKEN_TTL_DAYS * 86_400_000),
      campaignId: input.campaignId,
      messageId: input.messageId,
    },
  });
  return token;
}

export async function consumePreferenceToken(token: string) {
  if (!validPreferenceTokenFormat(token)) return null;
  return prisma.marketingEmailPreferenceToken.findFirst({
    where: { tokenHash: hashPreferenceToken(token), expiresAt: { gt: new Date() } },
    include: { preference: true },
  });
}

export async function addressIsMarketingEligible(normalizedEmail: string) {
  const [preference, suppression] = await Promise.all([
    prisma.marketingEmailPreference.findUnique({
      where: { normalizedEmail },
      select: { status: true },
    }),
    prisma.communicationSuppression.findFirst({
      where: { normalizedEmail, releasedAt: null },
      select: { id: true },
    }),
  ]);
  return !suppression && marketingStatusAllowsSend(preference?.status);
}
