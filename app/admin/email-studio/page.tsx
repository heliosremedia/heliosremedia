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
  const [clients, groups, campaigns, initialDraft, webhookHealth] = await Promise.all([
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
      select: { id: true, subject: true, previewText: true, body: true, templateKey: true, imageUrl: true, imageAlt: true, imageCaption: true, imageLink: true, status: true, recipientMode: true, selection: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, sentAt: true, scheduledAt: true, scheduledTimeZone: true, rowVersion: true, createdBy: { select: { displayName: true } }, recipients: { select: { id: true, status: true, providerMessageId: true, events: { select: { eventType: true } } } } },
    }),
    campaignId ? prisma.emailCampaign.findFirst({
      where: { id: campaignId, status: "DRAFT", createdById: session.userId },
      select: { id: true, subject: true, previewText: true, body: true, templateKey: true, imageUrl: true, imageAlt: true, imageCaption: true, imageLink: true, recipientMode: true, selection: true },
    }) : null,
    Promise.all([
      prisma.resendWebhookEvent.findFirst({
        where: { workspaceId: session.workspaceId },
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true },
      }),
      prisma.resendWebhookEvent.findFirst({
        where: { workspaceId: session.workspaceId, processingStatus: "PROCESSED" },
        orderBy: { processedAt: "desc" },
        select: { processedAt: true },
      }),
      prisma.resendWebhookEvent.findMany({
        where: { workspaceId: session.workspaceId, processingStatus: "FAILED_RETRYABLE" },
        orderBy: { receivedAt: "desc" },
        take: 5,
        select: { providerEventId: true, eventType: true, receivedAt: true, reason: true },
      }),
      prisma.resendWebhookEvent.count({
        where: { workspaceId: session.workspaceId, processingStatus: { startsWith: "UNMATCHED_" } },
      }),
    ]),
  ]);
  const eligibleClients = clients.filter(client => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email));
  const metrics = communicationMetrics(campaigns.flatMap(campaign => campaign.recipients.map(recipient => ({
    ...recipient,
    events: recipient.events.map(event => ({ ...event, linkUrl: null })),
  }))));
  const confirmedDeliveryRate = metrics.providerAccepted > 0
    ? Math.round((metrics.delivered / metrics.providerAccepted) * 100)
    : null;
  const [lastWebhookReceived, lastWebhookProcessed, webhookFailures, unmatchedWebhookCount] = webhookHealth;
  const formatHealthTime = (value: Date | null | undefined) => value
    ? value.toLocaleString("en-US", { timeZone: "America/Denver", timeZoneName: "short" })
    : "No event recorded";
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
    <section className="mb-7 rounded-2xl border border-white/[0.08] bg-[#111] p-5" aria-labelledby="webhook-health-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]">Webhook health</p><h2 id="webhook-health-title" className="mt-2 text-xl font-light text-white">Resend event ingestion</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/40">Delivery reporting is reconciled from recipient-level provider events. Duplicate replays are safe and never send email.</p></div>
        <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-right"><p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Unmatched events</p><p className={`mt-1 text-lg ${unmatchedWebhookCount ? "text-amber-100/70" : "text-emerald-200/75"}`}>{unmatchedWebhookCount}</p></div>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.07] px-4 py-3"><dt className="text-xs text-white/30">Last event received</dt><dd className="mt-1 text-white/65">{formatHealthTime(lastWebhookReceived?.receivedAt)}</dd></div>
        <div className="rounded-xl border border-white/[0.07] px-4 py-3"><dt className="text-xs text-white/30">Last event processed</dt><dd className="mt-1 text-white/65">{formatHealthTime(lastWebhookProcessed?.processedAt)}</dd></div>
      </dl>
      <div className="mt-4"><p className="text-xs text-white/30">Recent processing failures</p>{webhookFailures.length ? <ul className="mt-2 space-y-2">{webhookFailures.map((failure) => <li key={failure.providerEventId} className="rounded-lg border border-red-300/10 bg-red-300/[0.03] px-3 py-2 text-xs text-red-100/60">{failure.eventType} · {formatHealthTime(failure.receivedAt)} · {failure.reason || "Retryable processing error"}</li>)}</ul> : <p className="mt-2 text-sm text-emerald-200/60">No recent processing failures.</p>}</div>
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
