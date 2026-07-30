import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import BulkEmailStudio from "./BulkEmailStudio";
import AdminSummaryCards from "@/app/admin/components/AdminSummaryCards";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";

export const dynamic = "force-dynamic";

export default async function EmailStudioPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const session = await requireAdminSession();
  const campaignId = (await searchParams).campaign;
  const [clients, groups, campaigns, initialDraft] = await Promise.all([
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
      where: { createdBy: { workspaceId: session.workspaceId } },
      take: 25,
      orderBy: { createdAt: "desc" },
      select: { id: true, subject: true, previewText: true, body: true, status: true, recipientMode: true, selection: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, sentAt: true, scheduledAt: true, scheduledTimeZone: true, rowVersion: true, createdBy: { select: { displayName: true } }, recipients: { select: { status: true, providerMessageId: true, events: { select: { eventType: true } } } } },
    }),
    campaignId ? prisma.emailCampaign.findFirst({
      where: { id: campaignId, status: "DRAFT", createdById: session.userId },
      select: { id: true, subject: true, previewText: true, body: true, recipientMode: true, selection: true },
    }) : null,
  ]);
  return <AdminPageLayout
    header={<AdminPageHeader eyebrow="Client communications" title="Bulk Email Studio" description="Create polished updates for all clients, selected groups, or individual recipients—with a test step and unsubscribe protection built in." />}
    summary={<AdminSummaryCards items={[
      { label: "Eligible recipients", value: clients.filter(client=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)).length, detail: "Subscribed and deliverable" },
      { label: "Scheduled campaigns", value: campaigns.filter(item=>item.status==="SCHEDULED").length, detail: "Awaiting delivery" },
      { label: "Recently sent", value: campaigns.filter(item=>item.status==="SENT").length, detail: "Within recent campaign history", tone: "good" },
      { label: "Delivery health", value: campaigns.some(item=>item.sentCount>0) ? `${Math.round(100*campaigns.reduce((n,item)=>n+item.sentCount-item.failedCount,0)/Math.max(1,campaigns.reduce((n,item)=>n+item.sentCount,0)))}%` : null, detail: campaigns.some(item=>item.sentCount>0)?"Based on recorded sends":"No completed delivery data" },
    ]}/>}
  >
    <BulkEmailStudio
      clients={clients.filter((client) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)).map((client) => ({ id: client.id, firstName: client.firstName, lastName: client.lastName, displayName: client.displayName, email: client.email, phone: client.phone, groupIds: client.groupMemberships.map((membership) => membership.groupId) }))}
      groups={groups.map((group) => ({ id: group.id, name: group.name, count: group._count.memberships }))}
      campaigns={campaigns.map((campaign) => {
        const delivered = campaign.recipients.filter(recipient => recipient.events.some(event => event.eventType.toLowerCase() === "delivered")).length;
        const accepted = campaign.recipients.filter(recipient => recipient.providerMessageId && !recipient.events.some(event => event.eventType.toLowerCase() === "delivered")).length;
        const failed = campaign.recipients.filter(recipient => recipient.status === "FAILED").length;
        const awaitingConfirmation = campaign.recipients.filter(recipient => recipient.status === "SENT" && recipient.providerMessageId && !recipient.events.some(event => event.eventType.toLowerCase() === "delivered")).length;
        const { recipients: _recipients, ...record } = campaign;
        void _recipients;
        return { ...record, delivery: { delivered, accepted, failed, awaitingConfirmation }, selection: campaign.selection as { groupIds?: string[]; clientIds?: string[] }, createdAt: campaign.createdAt.toISOString(), sentAt: campaign.sentAt?.toISOString() ?? null, scheduledAt: campaign.scheduledAt?.toISOString() ?? null };
      })}
      canSend={session.role === "OWNER" || session.role === "ADMIN"}
      defaultTestEmail={session.email}
      initialDraft={initialDraft ? { ...initialDraft, selection: initialDraft.selection as { groupIds?: string[]; clientIds?: string[] } } : null}
    />
  </AdminPageLayout>;
}
