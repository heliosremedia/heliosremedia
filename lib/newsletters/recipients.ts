import { getContentOwnershipScope } from "@/lib/blog-ownership";
import "server-only";

import { prisma } from "@/lib/prisma";
import type { EligibleRecipient, RecipientSelection } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function resolveEligibleNewsletterRecipients(
  workspaceId: string,
  selection: RecipientSelection,
): Promise<{ eligible: EligibleRecipient[]; excludedCount: number }> {
  if (!workspaceId) throw new Error("Recipient workspace is required.");
  const groupOwnership = await getContentOwnershipScope(workspaceId);
  const selectedWhere =
    selection.mode === "ALL"
      ? {}
      : selection.mode === "GROUPS"
        ? { groupMemberships: { some: { groupId: { in: selection.groupIds }, group: groupOwnership } } }
        : selection.mode === "INDIVIDUALS"
          ? { id: { in: selection.clientIds } }
          : {
              OR: [
                { id: { in: selection.clientIds } },
                { groupMemberships: { some: { groupId: { in: selection.groupIds }, group: groupOwnership } } },
              ],
            };

  const candidates = await prisma.communicationClient.findMany({
    where: { AND: [selectedWhere], workspaceMemberships: { some: { workspaceId } } },
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
