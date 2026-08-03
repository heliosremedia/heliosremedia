import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import BulkEmailStudio from "./BulkEmailStudio";
import AdminSummaryCards from "@/app/admin/components/AdminSummaryCards";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { bouncedBackSystemKey } from "@/lib/client-communications/bounce-core";
import { communicationMetrics } from "@/lib/dashboard-core";

export const dynamic = "force-dynamic";

export default async function EmailStudioPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const session = await requireAdminSession();
  const campaignId = (await searchParams).campaign;
  const [clients, groups, campaigns, initialDraft] = await Promise.all([
    prisma.communicationClient.findMany({
      where: {
        emailSubscribed: true,
        emailStatus: "VALID",
        archivedAt: null,
        normalizedEmail: { not: "" },
        groupMemberships: { none: { group: { systemKey: bouncedBackSystemKey(session.workspaceId) } } },
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: { id: true, firstName: true, lastName: true, displayName: true, email: true, phone: true, groupMemberships: { select: { groupId: true } } },
    }),
    prisma.communicationGroup.findMany({
      where: { OR: [{ systemKey: null }, { systemKey: { not: { startsWith: "BOUNCED_BACK:" } } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { memberships: true } } },
    }),
    prisma.emailCampaign.findMany({
      where: { createdBy: { workspaceId: session.workspaceId } },
      take: 25,
      orderBy: { createdAt: "desc" },
      select: { id: true, subject: true, previewText: true, body: true, status: true, recipientMode: true, selection: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, sentAt: true, scheduledAt: true, scheduledTimeZone: true, rowVersion: true, createdBy: { select: { displayName: true } }, recipients: { select: { id: true, status: true, providerMessageId: true, events: { select: { eventType: true } } } } },
    }),
    campaignId ? prisma.emailCampaign.findFirst({
      where: { id: campaignId, status: "DRAFT", createdById: session.userId },
      select: { id: true, subject: true, previewText: true, body: true, recipientMode: true, selection: true },
    }) : null,
  ]);
  const eligibleClients = clients.filter(client => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email));
  const metrics = communicationMetrics(campaigns.flatMap(campaign => campaign.recipients.map(recipient => ({
    ...recipient,
    events: recipient.events.map(event => ({ ...event, linkUrl: null })),
  }))));
  const confirmedDeliveryRate = metrics.providerAccepted > 0
    ? Math.round((metrics.delivered / metrics.providerAccepted) * 100)
    : null;
  return <AdminPageLayout
    header={<AdminPageHeader eyebrow="Client communications" title="Bulk Email Studio" description="Create polished updates for all clients, selected groups, or individual recipients—with a test step and unsubscribe protection built in." />}
    summary={<AdminSummaryCards items={[
      { label: "Eligible recipients", value: eligibleClients.length, detail: "Subscribed, valid, and not suppressed" },
      { label: "Scheduled campaigns", value: campaigns.filter(item=>item.status==="SCHEDULED").length, detail: "Awaiting delivery" },
      { label: "Recently sent", value: campaigns.filter(item=>item.status==="SENT").length, detail: "Within recent campaign history", tone: "good" },
      { label: "Confirmed delivery", value: confirmedDeliveryRate === null ? null : `${confirmedDeliveryRate}%`, detail: metrics.providerAccepted ? `${metrics.delivered} of ${metrics.providerAccepted} provider-accepted messages confirmed delivered` : "No provider-accepted messages in recent history" },
    ]}/>}
  >
    <section id="analytics-health" className="mb-7 scroll-mt-28 rounded-2xl border border-white/[0.08] bg-[#111] p-5" aria-labelledby="analytics-health-title">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div><p className="text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]">Analytics health</p><h2 id="analytics-health-title" className="mt-2 text-xl font-light text-white">Provider-confirmed reporting</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/40">Helios counts a message as delivered only after a provider delivery event. Acceptance means the provider received the request, not that the message reached the inbox.</p></div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"><dt className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Accepted</dt><dd className="mt-1 text-lg text-white/70">{metrics.providerAccepted}</dd></div>
          <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.03] px-3 py-3"><dt className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Delivered</dt><dd className="mt-1 text-lg text-emerald-200/75">{metrics.delivered}</dd></div>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.03] px-3 py-3"><dt className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Awaiting</dt><dd className="mt-1 text-lg text-amber-100/70">{metrics.awaitingProviderConfirmation}</dd></div>
        </dl>
      </div>
    </section>
    <BulkEmailStudio
      clients={eligibleClients.map((client) => ({ id: client.id, firstName: client.firstName, lastName: client.lastName, displayName: client.displayName, email: client.email, phone: client.phone, groupIds: client.groupMemberships.map((membership) => membership.groupId) }))}
      groups={groups.map((group) => ({ id: group.id, name: group.name, count: eligibleClients.filter(client => client.groupMemberships.some(membership => membership.groupId === group.id)).length }))}
      campaigns={campaigns.map((campaign) => {
        const delivery = communicationMetrics(campaign.recipients.map(recipient => ({ ...recipient, events: recipient.events.map(event => ({ ...event, linkUrl: null })) })));
        const { recipients: _recipients, ...record } = campaign;
        void _recipients;
        return { ...record, delivery: { delivered: delivery.delivered, accepted: delivery.providerAccepted, failed: delivery.failed, awaitingConfirmation: delivery.awaitingProviderConfirmation }, selection: campaign.selection as { groupIds?: string[]; clientIds?: string[] }, createdAt: campaign.createdAt.toISOString(), sentAt: campaign.sentAt?.toISOString() ?? null, scheduledAt: campaign.scheduledAt?.toISOString() ?? null };
      })}
      canSend={session.role === "OWNER" || session.role === "ADMIN"}
      defaultTestEmail={session.email}
      initialDraft={initialDraft ? { ...initialDraft, selection: initialDraft.selection as { groupIds?: string[]; clientIds?: string[] } } : null}
    />
  </AdminPageLayout>;
}
