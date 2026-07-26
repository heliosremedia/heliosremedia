import "server-only";

import { prisma } from "@/lib/prisma";
import type { EligibleRecipient, RecipientSelection } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function resolveEligibleNewsletterRecipients(
  selection: RecipientSelection,
): Promise<{ eligible: EligibleRecipient[]; excludedCount: number }> {
  const selectedWhere =
    selection.mode === "ALL"
      ? {}
      : selection.mode === "GROUPS"
        ? { groupMemberships: { some: { groupId: { in: selection.groupIds } } } }
        : selection.mode === "INDIVIDUALS"
          ? { id: { in: selection.clientIds } }
          : {
              OR: [
                { id: { in: selection.clientIds } },
                { groupMemberships: { some: { groupId: { in: selection.groupIds } } } },
              ],
            };

  const candidates = await prisma.communicationClient.findMany({
    where: selectedWhere,
    select: {
      id: true,
      displayName: true,
      email: true,
      normalizedEmail: true,
      emailSubscribed: true,
      archivedAt: true,
      emailStatus: true,
    },
  });

  const suppressed = await prisma.communicationSuppression.findMany({
    where: {
      normalizedEmail: { in: [...new Set(candidates.map((client) => client.normalizedEmail).filter(Boolean))] },
      releasedAt: null,
    },
    select: { normalizedEmail: true },
  });
  const preferences = await prisma.marketingEmailPreference.findMany({
    where: {
      normalizedEmail: { in: [...new Set(candidates.map(client => client.normalizedEmail).filter(Boolean))] },
      status: { in: ["UNSUBSCRIBED", "SUPPRESSED"] },
    },
    select: { normalizedEmail: true },
  });
  const suppressedEmails = new Set(suppressed.map((entry) => entry.normalizedEmail));
  preferences.forEach(preference => suppressedEmails.add(preference.normalizedEmail));
  const eligibleByEmail = new Map<string, EligibleRecipient>();
  for (const client of candidates) {
    if (!client.emailSubscribed || client.archivedAt || client.emailStatus !== "VALID" ||
        !EMAIL_PATTERN.test(client.normalizedEmail) || suppressedEmails.has(client.normalizedEmail)) continue;
    if (!eligibleByEmail.has(client.normalizedEmail)) {
      eligibleByEmail.set(client.normalizedEmail, {
        id: client.id,
        displayName: client.displayName,
        email: client.email,
        normalizedEmail: client.normalizedEmail,
      });
    }
  }
  const eligible = [...eligibleByEmail.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { eligible, excludedCount: candidates.length - eligible.length };
}
