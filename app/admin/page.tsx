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
  timeZone: HELIOS_TIME_ZONE, month: "short", day: "numeric",
  ...(time ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
}).format(value);
const metric = (label: string, value: string | number, detail?: string) =>
  <div className="rounded-xl border border-white/[.07] bg-black/15 p-4"><p className="text-[.56rem] uppercase tracking-[.15em] text-white/30">{label}</p><p className="mt-2 text-2xl font-light text-white">{value}</p>{detail ? <p className="mt-2 text-xs text-white/30">{detail}</p> : null}</div>;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await requireAdminSession();
  const requested = Number((await searchParams).range);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const [dashboard, monitor, user] = await Promise.all([
    getDashboardData(session.workspaceId, days), getPublicMonitorSummary(),
    prisma.adminUser.findFirst({ where: { id: session.userId, workspaceId: session.workspaceId }, select: { dashboardPreferences: true } }),
  ]);
  const { operations, communications, content, relationships, website, activity } = dashboard;
  const canOperate = ["OWNER", "ADMIN"].includes(session.role);
  const m = communications.data.metrics;
  const providerConfirmed = m.delivered + m.bounces + m.complaints;
  const awaiting = Math.max(0, m.sent - providerConfirmed);
  const deliveryRate = m.sent > 0 && providerConfirmed > 0 ? `${m.deliveryRate.toFixed(1)}%` : "Awaiting Provider Data";
  const statuses = [
    ["Booking", operations.available ? operations.data.bookingMode || "Unknown" : "Unavailable", "/admin/settings"],
    ["Email analytics", communications.available ? (awaiting ? `${awaiting} awaiting confirmation` : "Synchronized") : "Unavailable", "/admin/email-studio"],
    ["Client sync", relationships.available ? (relationships.data.lastSync ? `Confirmed ${fmt(relationships.data.lastSync, true)}` : "Not confirmed") : "Unavailable — workspace ownership not recorded", "/admin/clients"],
    ["Public website", monitor.tone === "ONLINE" ? `Online${monitor.responseTimeMs !== null ? ` · ${monitor.responseTimeMs} ms` : ""}` : monitor.tone.replaceAll("_", " "), "/admin/settings"],
  ] as const;

  const cards = [
    { id: "action-required" as const, title: "Action Required", content:
      operations.data.attention.length ? <div className="grid gap-3 lg:grid-cols-2">{operations.data.attention.map(item => <Link key={item.id} href={item.href} className="rounded-xl border border-white/[.08] bg-white/[.025] p-4"><p className="text-[.56rem] uppercase tracking-[.14em] text-[var(--helios-orange)]">{item.type} · {fmt(item.date, true)}</p><p className="mt-2 text-sm leading-6 text-white/65">{item.message}</p><p className="mt-3 text-xs text-white/35">{item.action} →</p></Link>)}</div>
      : <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.035] p-5"><p className="text-sm text-emerald-100/65">Nothing verified currently needs immediate attention.</p><p className="mt-2 text-xs text-white/30">New inquiries, failed jobs, overdue reviews, and unavailable booking will appear here.</p></div> },
    { id: "todays-operations" as const, title: "Today’s Operations", content:
      operations.available && operations.data.upcoming.length ? <div className="divide-y divide-white/[.07]">{operations.data.upcoming.slice(0, 10).map(item => <Link key={item.id} href={item.href} className="grid grid-cols-[5rem_1fr_auto] gap-3 py-3 text-sm"><span className="text-white/30">{fmt(item.date)}</span><span className="text-white/65">{item.title}</span><span className="text-xs text-white/35">{item.state}</span></Link>)}</div>
      : <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/35">No scheduled work in the next 14 days. Create a project, review an inquiry, or prepare upcoming content.</p> },
    { id: "performance-snapshot" as const, title: "Compact Performance Snapshot", content:
      <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-white/35">Verified workspace-owned records from the last {days} days.</p><nav className="flex gap-1">{[7,30,90].map(range => <Link key={range} href={`/admin?range=${range}`} className={days === range ? "admin-btn-primary" : "admin-btn-secondary"}>{range} days</Link>)}</nav></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{metric("Assigned new inquiries", website.data.newInquiries)}{metric("Published projects", website.data.publishedProjects)}{metric("Campaigns", communications.data.campaigns)}{metric("Delivery rate", deliveryRate, awaiting ? `${awaiting} messages await provider confirmation.` : undefined)}{metric("Delivered", providerConfirmed ? m.delivered : "Unconfirmed")}{metric("Failed", m.failed)}{metric("Newsletter reviews", content.data.newsletterReviews)}{metric("Social planned", content.data.socialPlanned)}</div><details className="mt-4 rounded-xl border border-white/[.07] p-4"><summary className="cursor-pointer text-sm text-white/50">Communication Health details</summary><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{metric("Intended", m.intended)}{metric("Sent", m.sent)}{metric("Awaiting confirmation", awaiting)}{metric("Bounced", m.bounces)}{metric("Complained", m.complaints)}{metric("Suppressed", m.unsubscribes)}{metric("Unique clicks", m.uniqueClicks)}{metric("Estimated opens", m.estimatedOpens, "Privacy controls affect accuracy.")}</div><p className="mt-4 text-xs leading-5 text-white/35">{providerConfirmed ? `Provider events are deduplicated. Last dashboard synchronization ${fmt(dashboard.generatedAt, true)}.` : "No provider delivery event is available for this range. Sent records are not treated as delivered or failed until the provider confirms them."}</p></details></> },
    { id: "recent-activity" as const, title: "Unified Recent Activity", content:
      activity.available && activity.data.length ? <div className="divide-y divide-white/[.07]">{activity.data.map(item => <Link key={item.id} href={item.href} className="flex items-start justify-between gap-4 py-3"><span><span className="block text-sm text-white/60">{item.summary}</span><span className="mt-1 block text-[.56rem] uppercase tracking-[.14em] text-white/25">{item.action}</span></span><time className="shrink-0 text-xs text-white/30">{fmt(item.createdAt, true)}</time></Link>)}</div> : <p className="text-sm text-white/35">No recent verified activity is available.</p> },
    { id: "platform-health" as const, title: "Platform Health", content:
      <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statuses.map(([label,status,href]) => <Link key={label} href={href} className="rounded-xl border border-white/[.07] p-4"><p className="text-xs text-white/35">{label}</p><p className="mt-2 text-sm text-white/65">{status}</p></Link>)}</div><p className="mt-4 text-xs text-white/25">Last updated {fmt(dashboard.generatedAt, true)}. Unknown and stale states remain explicit.</p></> },
    { id: "quick-actions" as const, title: "Quick Actions", content:
      <div className="flex flex-wrap gap-3">{canOperate ? <><Link href="/admin/projects/new" className="admin-btn-primary">Create Project</Link><Link href="/admin/inquiries" className="admin-btn-secondary">Review Inquiries</Link><Link href="/admin/newsletter-studio" className="admin-btn-secondary">Newsletter Studio</Link><Link href="/admin/blog" className="admin-btn-secondary">Blog Studio</Link><Link href="/admin/email-studio" className="admin-btn-secondary">Email Studio</Link></> : <><Link href="/admin/projects" className="admin-btn-secondary">Projects</Link><Link href="/admin/media" className="admin-btn-secondary">Media</Link></>}<DashboardRefresh /></div> },
  ];
  return <div className="space-y-7 pb-10">
    <header className="flex flex-col gap-5 border-b border-white/[.08] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow text-[var(--helios-orange)]">{fmt(dashboard.generatedAt)}</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Admin Command Center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">What needs attention, what is happening today, and what changed across Helios Studio.</p></div><p className="text-xs text-white/30">{session.role} · Updated {fmt(dashboard.generatedAt, true)}</p></header>
    <DashboardOrganizer initialPreferences={normalizeDashboardPreferences(user?.dashboardPreferences)} cards={cards} />
  </div>;
}
