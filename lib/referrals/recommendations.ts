import "server-only";

import { prisma } from "@/lib/prisma";

export async function recommendedAdvocates(limit = 24) {
  const clients = await prisma.communicationClient.findMany({
    where: { archivedAt: null },
    include: {
      groupMemberships: { include: { group: { select: { name: true } } } },
      newsletterSuppressions: { where: { releasedAt: null }, select: { reason: true } },
      referralAdvocates: { include: { _count: { select: { submissions: true } } } },
    },
    orderBy: [{ updatedAt: "desc" }, { displayName: "asc" }],
    take: Math.max(limit * 4, 100),
  });
  return clients.map(client => {
    const warnings: string[] = [];
    if (!client.emailSubscribed) warnings.push("Unsubscribed from marketing email");
    if (client.emailStatus !== "VALID") warnings.push(`Email status is ${client.emailStatus.toLowerCase()}`);
    if (client.newsletterSuppressions.length) warnings.push("Email is actively suppressed");
    const referralCount = client.referralAdvocates.reduce((sum, advocate) => sum + advocate._count.submissions, 0);
    const groups = client.groupMemberships.map(item => item.group.name);
    const score = Math.max(0, Math.min(100, 55 + Math.min(groups.length * 5, 15) + Math.min(referralCount * 10, 30) - warnings.length * 40));
    return {
      id: client.id, displayName: client.displayName, email: client.email, groups,
      eligible: warnings.length === 0, score, warnings, referralCount,
      reason: referralCount
        ? `${referralCount} prior referral${referralCount === 1 ? "" : "s"} and an established Helios client relationship.`
        : groups.length
          ? `Active Helios client in ${groups.slice(0, 3).join(", ")} with current communication eligibility.`
          : "Current Helios client with valid communication eligibility.",
      historyNote: "Completed-order history is not available in the current local client model and was not inferred.",
    };
  }).sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName)).slice(0, limit);
}
