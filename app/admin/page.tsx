import Link from "next/link";
import DashboardOrganizer from "./components/DashboardOrganizer";
import DashboardRefresh from "./components/DashboardRefresh";
import { requireAdminSession } from "@/lib/auth/session";
import { normalizeDashboardPreferences } from "@/lib/dashboard-layout";
import { getDashboardData, HELIOS_TIME_ZONE } from "@/lib/dashboard";
import { getPublicMonitorSummary } from "@/lib/uptimerobot";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const fmt = (value: Date, time = false) => new Intl.DateTimeFormat("en-US", {
  timeZone: HELIOS_TIME_ZONE,
  month: "short",
  day: "numeric",
  ...(time ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
}).format(value);

const trend = (current: number, prior: number) => {
  if (!prior) return current ? "New activity in this period" : "No verified activity";
  const change = Math.round(((current - prior) / prior) * 100);
  return `${change >= 0 ? "+" : ""}${change}% vs previous period`;
};

function Metric({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string | number;
  detail: string;
  href: string;
}) {
  return <Link href={href} className="group rounded-xl border border-white/[.07] bg-black/15 p-4 transition hover:border-[var(--helios-orange)]/35 hover:bg-white/[.025] focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]">
    <p className="text-[.56rem] uppercase tracking-[.15em] text-white/30">{label}</p>
    <p className="mt-2 text-2xl font-light text-white">{value}</p>
    <p className="mt-2 text-xs leading-5 text-white/35">{detail}</p>
    <span className="mt-3 block text-[.58rem] uppercase tracking-[.13em] text-[var(--helios-orange)]/70 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">View details →</span>
  </Link>;
}

type HealthTone = "green" | "yellow" | "red" | "gray";
const healthStyles: Record<HealthTone, { dot: string; border: string; label: string }> = {
  green: { dot: "bg-emerald-400", border: "border-emerald-300/20", label: "Healthy" },
  yellow: { dot: "bg-amber-300", border: "border-amber-300/20", label: "Needs review" },
  red: { dot: "bg-red-400", border: "border-red-300/20", label: "Unavailable" },
  gray: { dot: "bg-white/30", border: "border-white/10", label: "Not verified" },
};

type HealthStatus = {
  label: string;
  tone: HealthTone;
  status: string;
  verified: string;
  action: string;
  href: string;
};

function HealthCard({ item }: { item: HealthStatus }) {
  const style = healthStyles[item.tone];
  return <Link href={item.href} className={`rounded-xl border ${style.border} bg-black/10 p-4 transition hover:bg-white/[.025] focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]`}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-white/65">{item.label}</p>
      <span className="flex items-center gap-2 text-[.56rem] uppercase tracking-[.13em] text-white/35">
        <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
        {style.label}
      </span>
    </div>
    <p className="mt-3 text-sm leading-5 text-white/55">{item.status}</p>
    <p className="mt-2 text-xs text-white/30">Verified {item.verified}</p>
    <p className="mt-3 text-xs text-[var(--helios-orange)]/75">{item.action} →</p>
  </Link>;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAdminSession();
  const requested = Number((await searchParams).range);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const [dashboard, monitor, user] = await Promise.all([
    getDashboardData(session.workspaceId, days),
    getPublicMonitorSummary(),
    prisma.adminUser.findFirst({
      where: { id: session.userId, workspaceId: session.workspaceId },
      select: { dashboardPreferences: true },
    }),
  ]);
  const { operations, communications, content, relationships, website, activity } = dashboard;
  const canOperate = ["OWNER", "ADMIN"].includes(session.role);
  const m = communications.data.metrics;
  const awaiting = m.awaitingProviderConfirmation;
  const confirmedOutcomes = m.delivered + m.bounces + m.complaints;
  const emailStudioCampaigns = Math.max(0, communications.data.campaigns - communications.data.newsletterCampaigns);
  const bookingMode = operations.data.bookingMode;
  const bookingTone: HealthTone = !operations.available
    ? "gray"
    : bookingMode === "ONLINE"
      ? "green"
      : bookingMode === "PAUSED"
        ? "yellow"
        : "red";
  const emailTone: HealthTone = !communications.available
    ? "gray"
    : communications.data.lastProviderEventAt
      ? "green"
      : "gray";
  const clientSyncTone: HealthTone = !relationships.available || !relationships.data.syncStatus
    ? "gray"
    : relationships.data.syncStatus === "SUCCEEDED"
      ? "green"
      : relationships.data.syncStatus === "FAILED"
        ? "red"
        : "yellow";
  const monitorTone: HealthTone = monitor.tone === "ONLINE"
    ? monitor.stale ? "yellow" : "green"
    : monitor.tone === "OFFLINE"
      ? "red"
      : "gray";
  const health: HealthStatus[] = [
    {
      label: "Booking",
      tone: bookingTone,
      status: operations.available ? `Public booking is ${(bookingMode || "unknown").toLowerCase()}.` : "Booking status could not be loaded.",
      verified: fmt(dashboard.generatedAt, true),
      action: bookingTone === "green" ? "Review booking settings" : "Correct booking availability",
      href: "/admin/settings",
    },
    {
      label: "Email Analytics",
      tone: emailTone,
      status: communications.data.lastProviderEventAt
        ? "Provider event synchronization is active."
        : "No workspace provider event has been confirmed.",
      verified: communications.data.lastProviderEventAt ? fmt(communications.data.lastProviderEventAt, true) : fmt(dashboard.generatedAt, true),
      action: emailTone === "green" ? "Open delivery reporting" : "Review analytics health",
      href: "/admin/email-studio#analytics-health",
    },
    {
      label: "Client Sync",
      tone: clientSyncTone,
      status: relationships.data.syncStatus === "SUCCEEDED" && relationships.data.lastSync
        ? `${relationships.data.provider || "Client provider"} · ${relationships.data.importedCount} imported, ${relationships.data.updatedCount} updated, ${relationships.data.skippedCount} skipped.`
        : relationships.data.syncStatus === "FAILED"
          ? `${relationships.data.provider || "Client provider"} synchronization failed with ${relationships.data.errorCount} recorded error.`
          : relationships.data.syncStatus === "RUNNING"
            ? `${relationships.data.provider || "Client provider"} synchronization is in progress.`
            : "No workspace-scoped client synchronization has been verified yet.",
      verified: relationships.data.lastSync ? fmt(relationships.data.lastSync, true) : fmt(dashboard.generatedAt, true),
      action: clientSyncTone === "red" ? "Retry client synchronization" : "Review client synchronization",
      href: "/admin/clients",
    },
    {
      label: "Public Website",
      tone: monitorTone,
      status: monitor.tone === "ONLINE"
        ? `Online${monitor.responseTimeMs !== null ? ` · ${monitor.responseTimeMs} ms response` : ""}.`
        : monitor.tone.replaceAll("_", " ").toLowerCase(),
      verified: monitor.lastSuccessfulCheck
        ? fmt(new Date(monitor.lastSuccessfulCheck), true)
        : monitor.lastAttemptedCheck
          ? fmt(new Date(monitor.lastAttemptedCheck), true)
          : fmt(dashboard.generatedAt, true),
      action: monitorTone === "green" ? "Review website settings" : "Review website availability",
      href: "/admin/settings",
    },
  ];

  const cards = [
    {
      id: "action-required" as const,
      title: "Action Required",
      summary: operations.data.attention.length ? `${operations.data.attention.length} items need review` : "All clear",
      content: operations.data.attention.length
        ? <div className="grid gap-3 lg:grid-cols-2">{operations.data.attention.map(item =>
          <Link key={item.id} href={item.href} className="rounded-xl border border-white/[.08] bg-white/[.025] p-4">
            <p className="text-[.56rem] uppercase tracking-[.14em] text-[var(--helios-orange)]">{item.type} · {fmt(item.date, true)}</p>
            <p className="mt-2 text-sm leading-6 text-white/65">{item.message}</p>
            <p className="mt-3 text-xs text-white/35">{item.action} →</p>
          </Link>)}</div>
        : <div className="flex items-center gap-3 rounded-lg border border-emerald-300/15 bg-emerald-300/[.035] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
          <p className="text-sm text-emerald-100/65">All clear—nothing verified currently needs immediate attention.</p>
        </div>,
    },
    {
      id: "todays-operations" as const,
      title: "Today & Upcoming",
      summary: `${operations.data.upcoming.length} verified items in the next 14 days`,
      content: operations.available && operations.data.upcoming.length
        ? <div className="divide-y divide-white/[.07]">{operations.data.upcoming.slice(0, 10).map(item =>
          <Link key={item.id} href={item.href} className="grid grid-cols-[5.5rem_1fr_auto] gap-3 py-3 text-sm">
            <span className="text-white/30">{fmt(item.date, true)}</span>
            <span><span className="block text-white/65">{item.title}</span><span className="mt-1 block text-xs text-white/25">{item.type}</span></span>
            <span className="text-xs text-white/35">{item.state}</span>
          </Link>)}</div>
        : <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/35">No verified work is scheduled in the next 14 days.</p>,
    },
    {
      id: "performance-snapshot" as const,
      title: "Studio Overview",
      summary: `${days}-day verified studio performance`,
      content: <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/35">Verified activity for the last {days} days. Select a metric to open its source.</p>
          <nav className="flex gap-1" aria-label="Studio Overview timeframe">{[7, 30, 90].map(range =>
            <Link key={range} href={`/admin?range=${range}`} className={days === range ? "admin-btn-primary" : "admin-btn-secondary"}>{range} days</Link>)}</nav>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="New inquiries" value={website.data.newInquiries} detail={`Assigned in the last ${days} days`} href="/admin/inquiries" />
          <Metric label="Published projects" value={website.data.publishedProjects} detail={`Published in the last ${days} days`} href="/admin/projects" />
          <Metric label="Portfolio views" value={website.data.portfolioViews} detail={trend(website.data.portfolioViews, website.data.priorPortfolioViews)} href="/admin/portfolio-intelligence" />
          <Metric label="Project drafts" value={website.data.draftProjects} detail="Current projects awaiting publication" href="/admin/projects" />
          <Metric label="Newsletter sends" value={communications.data.newsletterCampaigns} detail={`Accepted campaigns in the last ${days} days`} href="/admin/newsletter-studio" />
          <Metric label="Email Studio sends" value={emailStudioCampaigns} detail={`Accepted campaigns in the last ${days} days`} href="/admin/email-studio" />
          <Metric label="Confirmed delivered" value={m.delivered} detail={confirmedOutcomes ? `${m.deliveryRate.toFixed(1)}% of accepted messages confirmed delivered` : "No confirmed delivery events in this period"} href="/admin/email-studio" />
          <Metric label="Content reviews" value={content.data.newsletterReviews} detail="Newsletter editions awaiting review" href="/admin/newsletter-studio" />
        </div>
        <details className="mt-4 rounded-xl border border-white/[.07] p-4">
          <summary className="cursor-pointer text-sm text-white/50">Communication Health details</summary>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Intended" value={m.intended} detail="Eligible recipients selected" href="/admin/email-studio" />
            <Metric label="Provider accepted" value={m.providerAccepted} detail="Requests with provider message IDs" href="/admin/email-studio" />
            <Metric label="Awaiting confirmation" value={awaiting} detail="Accepted without a final provider event" href="/admin/email-studio" />
            <Metric label="Delivered" value={m.delivered} detail="Provider-confirmed delivery events" href="/admin/email-studio" />
            <Metric label="Failed" value={m.failed} detail="Helios delivery failures" href="/admin/email-studio" />
            <Metric label="Bounced" value={m.bounces} detail="Provider-confirmed bounces" href="/admin/email-studio" />
            <Metric label="Suppressed" value={m.suppressed} detail="Recipients excluded before delivery" href="/admin/clients" />
            <Metric label="Unique clicks" value={m.uniqueClicks} detail="Deduplicated recipient clicks" href="/admin/email-studio" />
          </div>
          <p className="mt-4 text-xs leading-5 text-white/35">Awaiting confirmation can include historical sends that have not been reconciled. It is reported honestly but does not determine current platform health. Provider events are deduplicated. Last dashboard verification {fmt(dashboard.generatedAt, true)}.</p>
        </details>
      </>,
    },
    {
      id: "recent-activity" as const,
      title: "Recent Activity",
      summary: `${activity.data.length} recent workspace events`,
      content: activity.available && activity.data.length
        ? <div className="divide-y divide-white/[.07]">{activity.data.map(item =>
          <Link key={item.id} href={item.href} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:gap-4">
            <span>
              <span className="block text-sm leading-6 text-white/65">{item.summary}</span>
              <span className="mt-1 block text-[.56rem] uppercase tracking-[.14em] text-[var(--helios-orange)]/65">{item.action.replaceAll("_", " ")}</span>
            </span>
            <time className="text-xs text-white/30">{fmt(item.createdAt, true)}</time>
          </Link>)}</div>
        : <p className="text-sm text-white/35">No recent verified workspace activity is available.</p>,
    },
    {
      id: "platform-health" as const,
      title: "Platform Health",
      summary: `${health.filter(item => item.tone === "green").length} of ${health.length} systems verified healthy`,
      content: <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{health.map(item => <HealthCard key={item.label} item={item} />)}</div>
        <p className="mt-4 text-xs text-white/25">Gray means the system could not be verified from workspace-owned data. It is not treated as healthy or failed.</p>
      </>,
    },
    {
      id: "quick-actions" as const,
      title: "Quick Actions",
      summary: canOperate ? "Create, review, and publish studio work" : "Open available studio work",
      content: <div className="flex flex-wrap gap-3">
        {canOperate ? <>
          <Link href="/admin/projects/new" className="admin-btn-primary">Create Project</Link>
          <Link href="/admin/inquiries" className="admin-btn-secondary">Review Inquiries</Link>
          <Link href="/admin/newsletter-studio" className="admin-btn-secondary">Newsletter Studio</Link>
          <Link href="/admin/blog" className="admin-btn-secondary">Blog Studio</Link>
          <Link href="/admin/email-studio" className="admin-btn-secondary">Email Studio</Link>
        </> : <>
          <Link href="/admin/projects" className="admin-btn-secondary">Projects</Link>
          <Link href="/admin/media" className="admin-btn-secondary">Media</Link>
        </>}
        <DashboardRefresh />
      </div>,
    },
  ];

  return <div className="space-y-7 pb-10">
    <header className="flex flex-col gap-5 border-b border-white/[.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow text-[var(--helios-orange)]">{fmt(dashboard.generatedAt)}</p>
        <h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">A clear view of studio priorities, upcoming work, portfolio activity, publishing, and platform health.</p>
      </div>
      <p className="text-xs text-white/30">{session.role} · Verified {fmt(dashboard.generatedAt, true)}</p>
    </header>
    <DashboardOrganizer initialPreferences={normalizeDashboardPreferences(user?.dashboardPreferences)} cards={cards} />
  </div>;
}
