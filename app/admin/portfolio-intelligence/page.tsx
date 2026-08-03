import Link from "next/link";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import AdminSummaryCards from "@/app/admin/components/AdminSummaryCards";
import PortfolioIntelligenceControls from "./PortfolioIntelligenceControls";
import { requireAdminSession } from "@/lib/auth/session";
import { getPortfolioAnalytics, getPortfolioAnalyticsHealth, type AnalyticsRange } from "@/lib/portfolio-analytics";
import { prisma } from "@/lib/prisma";

function validRange(value?: string): AnalyticsRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

export default async function PortfolioIntelligencePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await requireAdminSession();
  const generatedAt = new Date().toISOString();
  const ownsSite = await prisma.siteSettings.findFirst({ where: { workspaceId: session.workspaceId }, select: { id: true } });
  const range = validRange((await searchParams).range);
  const [report, health] = ownsSite ? await Promise.all([
    getPortfolioAnalytics(session.workspaceId, range),
    getPortfolioAnalyticsHealth(session.workspaceId),
  ]) : [null, { state: "workspace" as const, label: "Workspace configuration needed", detail: "Managed Site Settings are not connected to this workspace." }];
  const projectRows = ownsSite ? await prisma.portfolioAnalyticsEvent.groupBy({
    by: ["projectId", "eventName"], where: { workspaceId: session.workspaceId, projectId: { not: null }, occurredAt: { gte: new Date(report!.since) } },
    _count: { _all: true },
  }) : [];
  const visitorRows = ownsSite ? await prisma.portfolioAnalyticsEvent.groupBy({
    by: ["projectId", "sessionId"], where: { workspaceId: session.workspaceId, projectId: { not: null }, occurredAt: { gte: new Date(report!.since) } },
  }) : [];
  const projects = await prisma.project.findMany({
    where: { workspaceId: session.workspaceId, status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
    select: { id: true, title: true, slug: true, status: true, publishedAt: true },
  });
  const projectMetrics = new Map<string, { views: number; engagement: number; visitors: number }>();
  for (const row of projectRows) {
    if (!row.projectId) continue;
    const metric = projectMetrics.get(row.projectId) || { views: 0, engagement: 0, visitors: 0 };
    if (row.eventName === "PROJECT_VIEW") metric.views += row._count._all;
    else if (row.eventName !== "PORTFOLIO_VIEW") metric.engagement += row._count._all;
    projectMetrics.set(row.projectId, metric);
  }
  for (const row of visitorRows) {
    if (!row.projectId) continue;
    const metric = projectMetrics.get(row.projectId) || { views: 0, engagement: 0, visitors: 0 };
    metric.visitors += 1;
    projectMetrics.set(row.projectId, metric);
  }
  return <AdminPageLayout
    header={<AdminPageHeader
      eyebrow="Portfolio Intelligence"
      title="Public engagement"
      description="Privacy-conscious signals showing which projects, media, filters, shares, and traffic sources generate meaningful attention."
      note="Measurement began with V1.8.6. Unique visitors are anonymous session estimates, not identified people."
      actions={<PortfolioIntelligenceControls range={range} generatedAt={generatedAt}/>}
    />}
    summary={report ? <AdminSummaryCards label="Portfolio performance" items={[
      { label: "Portfolio views", value: report.counts.PORTFOLIO_VIEW || 0 },
      { label: "Project views", value: report.counts.PROJECT_VIEW || 0 },
      { label: "Estimated visitors", value: report.estimatedUniqueVisitors, detail: "Anonymous session estimate" },
      { label: "Engagement actions", value: Object.entries(report.counts).filter(([name])=>!["PORTFOLIO_VIEW","PROJECT_VIEW"].includes(name)).reduce((sum,[,value])=>sum+value,0), detail: report.periodChangePercent===null?"Comparison available after a prior period":`${report.periodChangePercent>=0?"+":""}${report.periodChangePercent}% vs prior period` },
    ]}/> : undefined}
  >
    <section className={`rounded-2xl border p-5 ${health.state === "recent" ? "border-emerald-300/20 bg-emerald-300/[0.04]" : health.state === "awaiting" ? "border-white/[0.08] bg-white/[0.02]" : "border-amber-300/20 bg-amber-300/[0.04]"}`} aria-label="Analytics health">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(18rem,1.2fr)] sm:items-center sm:gap-8"><div><p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-white/30">Analytics health</p><h2 className="mt-2 text-lg font-light text-white">{health.label}</h2></div><p className="max-w-2xl text-xs leading-5 text-white/40 sm:justify-self-end">{health.detail}</p></div>
    </section>
    {!ownsSite ? <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-6"><h2 className="text-xl text-amber-100">Portfolio ownership is not configured</h2><p className="mt-3 text-sm leading-6 text-white/40">Connect this workspace to managed Site Settings before analytics can be collected or viewed.</p></section> :
    report && <div className="grid gap-5 xl:grid-cols-2">
      {Object.values(report.counts).every(value=>value===0) && <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-8 text-center xl:col-span-2"><h2 className="text-2xl font-light text-white">Awaiting public activity</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/35">Analytics began with V1.8.6. No historical activity has been fabricated; every published project remains available below.</p></section>}
      <ReportList title="Traffic sources" rows={report.sources}/>
      <ReportList title="Devices" rows={report.devices}/>
      <ReportList title="Share launcher activity" description="A share option was activated. This does not confirm a social post was published." rows={report.channels.filter(row=>row.eventName==="PROJECT_SHARE")}/>
      <ReportList title="Managed filters" rows={report.targets.filter(row=>row.eventName==="PORTFOLIO_FILTER_USE")}/>
      <ReportList title="CTA activity" description="Intentional clicks on managed Helios calls to action. Empty means no CTA interaction was measured." rows={report.targets.filter(row=>row.eventName==="CTA_CLICK")}/>
      <ReportList title="Outbound destinations" description="Intentional clicks to websites outside Helios. Asset requests, internal navigation, and automated loading are excluded." rows={report.targets.filter(row=>row.eventName==="OUTBOUND_LINK_CLICK")}/>
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6 xl:col-span-2"><h2 className="text-xl font-light text-white">Published projects</h2><p className="mt-2 text-sm text-white/35">All published projects are shown, including zero-data Insights. Ordered by most recently published.</p><div className="mt-5 divide-y divide-white/[0.06]">{projects.map(project=>{const metric=projectMetrics.get(project.id)||{views:0,visitors:0,engagement:0};return <Link key={project.id} href={`/admin/portfolio-intelligence/${project.id}?range=${range}`} className="grid min-h-16 grid-cols-1 gap-2 py-3 text-sm text-white/55 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><span className="truncate">{project.title}</span><span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/35"><span>{metric.views} views</span><span>{metric.visitors} estimated visitors</span><span>{metric.engagement} engagements</span></span></Link>})}</div></section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6 xl:col-span-2"><h2 className="text-xl font-light text-white">Metric definitions</h2><dl className="mt-4 grid gap-4 text-sm leading-6 sm:grid-cols-2"><div><dt className="text-white/65">CTA Clicks</dt><dd className="text-white/35">The total number of intentional activations of managed calls to action.</dd></div><div><dt className="text-white/65">CTA Activity</dt><dd className="text-white/35">The CTA targets behind those clicks. Unrelated outbound activity is never substituted.</dd></div><div><dt className="text-white/65">Outbound Clicks</dt><dd className="text-white/35">Intentional navigation to a reportable external destination, excluding Helios and asset hosts.</dd></div><div><dt className="text-white/65">Shares</dt><dd className="text-white/35">Share-option activation or completed native share-sheet interaction, not provider-confirmed publication.</dd></div></dl><p className="mt-5 text-xs leading-5 text-white/25">Counts describe interactions measured in the Helios public experience. They do not identify people or claim provider-side publication.</p></section>
    </div>}
  </AdminPageLayout>;
}

function ReportList({ title, description, rows }: { title: string; description?: string; rows: { label: string; url?: string | null; value: number }[] }) {
  const max = Math.max(1, ...rows.map(row=>row.value));
  return <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6"><h2 className="text-xl font-light text-white">{title}</h2>{description&&<p className="mt-2 text-xs leading-5 text-white/30">{description}</p>}<div className="mt-5 space-y-4">{rows.length?rows.map(row=><div key={`${row.label}:${row.url||""}`}><div className="flex justify-between gap-3 text-xs text-white/45"><span className="min-w-0"><span className="block">{row.label}</span>{row.url&&<span className="mt-1 block truncate font-mono text-[0.65rem] normal-case text-white/25" title={row.url}>{row.url}</span>}</span><span>{row.value}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[var(--helios-orange)]" style={{width:`${Math.max(3,row.value/max*100)}%`}}/></div></div>):<p className="text-sm text-white/30">No measured data in this range.</p>}</div></section>;
}
