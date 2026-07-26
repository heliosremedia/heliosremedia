import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import BulkEmailStudio from "./BulkEmailStudio";

export const dynamic = "force-dynamic";

export default async function EmailStudioPage() {
  const session = await requireAdminSession();
  const [clients, groups, campaigns] = await Promise.all([
    prisma.communicationClient.findMany({
      where: { emailSubscribed: true, normalizedEmail: { not: "" } },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: { id: true, firstName: true, lastName: true, displayName: true, email: true, phone: true, groupMemberships: { select: { groupId: true } } },
    }),
    prisma.communicationGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { memberships: true } } },
    }),
    prisma.emailCampaign.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
      select: { id: true, subject: true, previewText: true, body: true, status: true, recipientMode: true, selection: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, sentAt: true, scheduledAt: true, scheduledTimeZone: true, rowVersion: true, createdBy: { select: { displayName: true } } },
    }),
  ]);
  return <div className="space-y-7">
    <section className="border-b border-white/[0.08] pb-7">
      <p className="eyebrow text-[var(--helios-orange)]">Client communications</p>
      <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Bulk Email Studio</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Create polished updates for all clients, selected groups, or individual recipients—with a test step and unsubscribe protection built in.</p>
    </section>
    <BulkEmailStudio
      clients={clients.filter((client) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)).map((client) => ({ id: client.id, firstName: client.firstName, lastName: client.lastName, displayName: client.displayName, email: client.email, phone: client.phone, groupIds: client.groupMemberships.map((membership) => membership.groupId) }))}
      groups={groups.map((group) => ({ id: group.id, name: group.name, count: group._count.memberships }))}
      campaigns={campaigns.map((campaign) => ({ ...campaign, selection: campaign.selection as { groupIds?: string[]; clientIds?: string[] }, createdAt: campaign.createdAt.toISOString(), sentAt: campaign.sentAt?.toISOString() ?? null, scheduledAt: campaign.scheduledAt?.toISOString() ?? null }))}
      canSend={session.role === "OWNER" || session.role === "ADMIN"}
      defaultTestEmail={session.email}
    />
  </div>;
}
