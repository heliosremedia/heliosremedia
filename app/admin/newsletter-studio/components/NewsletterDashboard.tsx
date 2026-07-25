"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import type { NewsletterDashboardData, NewsletterEdition } from "../types";

const empty: NewsletterDashboardData = { nextEdition: null, editions: [], series: [], groups: [] };
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Denver" }).format(new Date(value)) : "Not planned";

export default function NewsletterDashboard() {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void (async () => {
    try { const response = await fetch("/api/admin/newsletters", { cache: "no-store" }); const result = await response.json(); if (response.ok && result.success) setData(result.data); }
    finally { setLoading(false); }
  })(); }, []);
  async function action(actionName: string, payload: Record<string, unknown>) {
    setMessage("Working…");
    const response = await fetch("/api/admin/newsletters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, ...payload }) });
    const result = await response.json(); setMessage(response.ok && result.success ? result.message || "Updated." : result.error || "The request could not be completed.");
  }
  const needsReview = data.editions.filter(item => item.status === "NEEDS_REVIEW" || item.status === "MISSED_APPROVAL");
  const scheduled = data.editions.filter(item => item.status === "SCHEDULED");
  return <div className="space-y-7">
    <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow text-[var(--helios-orange)]">Editorial &amp; marketing</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Newsletter Studio</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Prepare verified, brand-led monthly newsletters with AI assistance and a mandatory approval gate.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/admin/newsletter-studio/series/new" className="admin-btn-secondary">Create newsletter series</Link><button className="admin-btn-primary" disabled={!data.nextEdition} onClick={() => data.nextEdition && action("generate", { editionId: data.nextEdition.id })}>Generate now</button></div>
    </section>
    {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">{message}</p>}
    {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.02]" />)}</div> :
    <>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
        <article className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#111] p-5 sm:p-7">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--helios-orange)]/70 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white/30">Next edition</p><h2 className="mt-3 text-2xl font-light text-white">{data.nextEdition?.subject || "No edition planned"}</h2><p className="mt-2 text-sm text-white/35">{data.nextEdition?.seriesName || "Create a recurring series to begin."}</p></div>{data.nextEdition && <StatusBadge status={data.nextEdition.status} />}</div>
          {data.nextEdition && <><div className="mt-7 grid gap-4 sm:grid-cols-3"><Metric label="AI draft" value={date(data.nextEdition.generationAt)} /><Metric label="Intended send" value={date(data.nextEdition.intendedSendAt)} /><Metric label="Eligible audience" value={`${data.nextEdition.eligibleCount} recipients`} /></div>
          <div className="mt-6 flex flex-wrap gap-2"><Link href={`/admin/newsletter-studio/editions/${data.nextEdition.id}`} className="admin-btn-primary">{data.nextEdition.status === "NEEDS_REVIEW" ? "Review edition" : "Open edition"}</Link></div></>}
        </article>
        <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6"><p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white/30">Content warnings</p>{data.nextEdition?.warnings.length ? <ul className="mt-4 space-y-3">{data.nextEdition.warnings.map(warning => <li key={warning} className="flex gap-3 text-sm leading-6 text-amber-100/70"><span aria-hidden="true">•</span>{warning}</li>)}</ul> : <p className="mt-4 text-sm leading-6 text-white/35">No outstanding warnings for the next edition.</p>}</article>
      </section>
      <DashboardList title="Needs your review" editions={needsReview} emptyText="No editions are waiting for review." />
      <DashboardList title="Scheduled" editions={scheduled} emptyText="No editions are scheduled." />
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]"><div className="flex items-center justify-between border-b border-white/[0.07] p-5 sm:px-6"><div><h2 className="text-2xl font-light text-white">Newsletter series</h2><p className="mt-1 text-sm text-white/35">Recurring editorial plans and their next milestones.</p></div></div>
      <div className="divide-y divide-white/[0.06]">{data.series.map(series => <article key={series.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><div className="flex items-center gap-3"><p className="text-white/75">{series.name}</p><span className={`text-[0.52rem] uppercase tracking-[.14em] ${series.active ? "text-emerald-200/70" : "text-white/30"}`}>{series.active ? "Active" : "Paused"}</span></div><p className="mt-2 text-sm text-white/30">Next draft {date(series.nextGenerationAt)} · Send {date(series.nextSendAt)}</p></div><div className="flex gap-2"><button className="admin-btn-secondary" onClick={() => action(series.active ? "pause-series" : "resume-series", { seriesId: series.id })}>{series.active ? "Pause" : "Resume"}</button><Link href={`/admin/newsletter-studio/series/${series.id}`} className="admin-btn-link">Edit</Link></div></article>)}{!data.series.length && <p className="p-6 text-sm text-white/30">No newsletter series yet.</p>}</div></section>
      <DashboardList title="Recent editions" editions={data.editions.slice(0, 8)} emptyText="Generated editions will appear here." />
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[0.52rem] font-semibold uppercase tracking-[.15em] text-white/25">{label}</p><p className="mt-2 text-sm text-white/65">{value}</p></div>; }
function DashboardList({ title, editions, emptyText }: { title: string; editions: NewsletterEdition[]; emptyText: string }) { return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]"><div className="border-b border-white/[0.07] p-5 sm:px-6"><h2 className="text-2xl font-light text-white">{title}</h2></div><div className="divide-y divide-white/[0.06]">{editions.map(item => <Link key={item.id} href={`/admin/newsletter-studio/editions/${item.id}`} className="flex flex-col gap-3 p-5 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><p className="truncate text-white/70">{item.subject || "Untitled edition"}</p><p className="mt-1 text-xs text-white/30">{item.seriesName} · {date(item.intendedSendAt)}</p></div><StatusBadge status={item.status} /></Link>)}{!editions.length && <p className="p-6 text-sm text-white/30">{emptyText}</p>}</div></section>; }
