import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPageLayout, { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import AdminSummaryCards from "@/app/admin/components/AdminSummaryCards";
import { requireAdminSession } from "@/lib/auth/session";
import { getPortfolioAnalytics, type AnalyticsRange } from "@/lib/portfolio-analytics";
import { prisma } from "@/lib/prisma";

export default async function ProjectInsightsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ range?: string }> }) {
  const session = await requireAdminSession();
  const ownsSite = await prisma.siteSettings.findFirst({ where: { workspaceId: session.workspaceId }, select: { id: true } });
  if (!ownsSite) notFound();
  const project = await prisma.project.findFirst({ where: { id: (await params).projectId, workspaceId: session.workspaceId }, select: { id: true, title: true, slug: true } });
  if (!project) notFound();
  const requested = (await searchParams).range;
  const range: AnalyticsRange = requested==="7d"||requested==="90d"?requested:"30d";
  const report = await getPortfolioAnalytics(session.workspaceId,range,project.id);
  const metrics = [
    ["Project views",report.counts.PROJECT_VIEW||0],["Estimated visitors",report.estimatedUniqueVisitors],
    ["Gallery opens",report.counts.GALLERY_IMAGE_OPEN||0],["Video starts",report.counts.VIDEO_START||0],
    ["25% viewed",report.counts.VIDEO_PROGRESS_25||0],["50% viewed",report.counts.VIDEO_PROGRESS_50||0],
    ["75% viewed",report.counts.VIDEO_PROGRESS_75||0],["Completions",report.counts.VIDEO_COMPLETE||0],
    ["Shares",report.counts.PROJECT_SHARE||0],["CTA clicks",report.counts.CTA_CLICK||0],
    ["Outbound clicks",report.counts.OUTBOUND_LINK_CLICK||0],
  ] as const;
  return <AdminPageLayout
    header={<AdminPageHeader eyebrow="Per-project Insights" title={project.title} description="Measured public interaction for this project only." note="Estimated visitors are anonymous sessions." actions={<><Link href="/admin/portfolio-intelligence" className="admin-btn-secondary">Portfolio report</Link><Link href={`/portfolio/${project.slug}`} target="_blank" className="admin-btn-primary">Open project ↗</Link></>}/>}
    summary={<AdminSummaryCards items={metrics.slice(0,4).map(([label,value])=>({label,value}))}/>}
  >
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.slice(4).map(([label,value])=><article key={label} className="rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-[0.54rem] font-semibold uppercase tracking-[0.16em] text-white/30">{label}</p><p className="mt-3 text-3xl font-light text-white">{value}</p></article>)}</section>
    <div className="grid gap-5 xl:grid-cols-2">
      <Breakdown title="Shares by channel" rows={report.channels.filter(row=>row.eventName==="PROJECT_SHARE")}/>
      <Breakdown title="CTA activity" rows={report.targets.filter(row=>row.eventName==="CTA_CLICK")}/>
      <Breakdown title="Outbound destinations" rows={report.targets.filter(row=>row.eventName==="OUTBOUND_LINK_CLICK")}/>
    </div>
    <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6"><h2 className="text-xl font-light text-white">Trend</h2>{report.trend.length?<div className="mt-6 flex h-40 items-end gap-1" aria-label="Daily engagement trend">{report.trend.map(day=><div key={day.date} title={`${day.date}: ${day.value}`} className="min-w-1 flex-1 bg-[var(--helios-orange)]/75" style={{height:`${Math.max(4,day.value/Math.max(...report.trend.map(item=>item.value))*100)}%`}}/>)}</div>:<p className="mt-4 text-sm text-white/30">No activity in this range.</p>}</section>
  </AdminPageLayout>;
}

function Breakdown({title,rows}:{title:string;rows:{label:string;value:number}[]}) {
  return <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6"><h2 className="text-xl font-light text-white">{title}</h2><div className="mt-4 divide-y divide-white/[0.06]">{rows.length?rows.map(row=><div key={row.label} className="flex min-h-11 items-center justify-between gap-4 text-sm text-white/45"><span className="truncate">{row.label}</span><span>{row.value}</span></div>):<p className="text-sm text-white/30">No measured data in this range.</p>}</div></section>;
}
