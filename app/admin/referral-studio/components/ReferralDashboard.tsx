"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardData = {
  metrics: Record<string, number>;
  campaigns: Array<{ id: string; internalName: string; publicTitle: string; status: string; updatedAt: string; _count: { advocates: number; invitations: number; submissions: number } }>;
  submissions: Array<{ id: string; firstName: string; lastName: string; status: string; attributionStatus: string; createdAt: string; campaign: { publicTitle: string }; advocate: { client: { displayName: string } } | null }>;
  clientCount: number;
};

type Recommendation = {
  id: string; displayName: string; email: string; groups: string[]; eligible: boolean;
  score: number; warnings: string[]; referralCount: number; reason: string; historyNote: string;
};

const labels: Array<[string, string]> = [
  ["active", "Active campaigns"], ["draft", "Draft campaigns"], ["paused", "Paused campaigns"],
  ["invitationsSent", "Invitations sent"], ["visits", "Landing visits"], ["submissions", "Submissions"],
  ["qualified", "Qualified"], ["booked", "Booked"], ["completed", "Completed"],
  ["pendingRewards", "Pending rewards"], ["issuedRewards", "Rewards issued"], ["conversionRate", "Conversion"],
];

function statusTone(status: string) {
  if (["ACTIVE", "QUALIFIED", "BOOKED", "COMPLETED", "REWARD_ISSUED", "CONFIRMED"].includes(status)) return "text-emerald-200 border-emerald-300/20 bg-emerald-300/[0.07]";
  if (["PAUSED", "NEEDS_REVIEW", "PENDING_REVIEW"].includes(status)) return "text-amber-100 border-amber-200/20 bg-amber-200/[0.07]";
  return "text-white/45 border-white/10 bg-white/[0.03]";
}

export default function ReferralDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/referrals?days=${days}`, { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Referral Studio could not be loaded.");
      if (active) setData(result.data);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Referral Studio could not be loaded."); });
    void fetch("/api/admin/referrals/recommendations", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (response.ok && result.success && active) setRecommendations(result.recommendations);
    });
    return () => { active = false; };
  }, [days]);

  return <div className="space-y-7">
    <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="eyebrow text-[var(--helios-orange)]">Relationships &amp; growth</p>
        <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Referral Studio</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Create respectful referral campaigns, review every invitation, and follow each relationship from introduction through thank-you.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="referral-range">Date range</label>
        <select id="referral-range" value={days} onChange={event => setDays(Number(event.target.value))} className="admin-input w-auto">
          <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option>
        </select>
        <a href="/api/admin/referrals/export" className="admin-btn-secondary">Export referrals</a>
        <Link href="/admin/referral-studio/referrals/new" className="admin-btn-secondary">Add manual referral</Link>
        <Link href="/admin/referral-studio/campaigns/new" className="admin-btn-primary">Create campaign</Link>
      </div>
    </section>
    {error && <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[0.06] px-4 py-3 text-sm text-red-100">{error}</p>}
    {!data ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.02]" />)}</div> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {labels.map(([key, label]) => <article key={key} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <p className="text-[0.56rem] font-semibold uppercase tracking-[.18em] text-white/30">{label}</p>
          <p className="mt-3 text-3xl font-light text-white">{key === "conversionRate" ? `${data.metrics[key] ?? 0}%` : data.metrics[key] ?? 0}</p>
        </article>)}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1fr_.85fr]">
        <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="text-2xl font-light text-white">Campaigns</h2><p className="mt-1 text-sm text-white/35">Draft, active, paused, and completed programs.</p></div><label className="flex cursor-pointer items-center gap-2 text-xs text-white/40"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} className="accent-[var(--helios-orange)]" />Show archived</label></div>
          <div className="divide-y divide-white/[0.06]">{data.campaigns.filter(campaign => showArchived || campaign.status !== "ARCHIVED").map(campaign => <div key={campaign.id} className="flex flex-col gap-3 p-5 transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Link href={`/admin/referral-studio/campaigns/${campaign.id}`} className="min-w-0 flex-1"><p className="truncate text-white/75">{campaign.internalName}</p><p className="mt-1 text-xs text-white/30">{campaign._count.advocates} advocates · {campaign._count.submissions} referrals</p></Link>
            <div className="flex flex-wrap items-center gap-2"><span className={`w-fit rounded-full border px-2.5 py-1 text-[0.54rem] uppercase tracking-[.14em] ${statusTone(campaign.status)}`}>{campaign.status}</span>{campaign.status === "DRAFT" && <Link href={`/admin/referral-studio/campaigns/${campaign.id}/edit`} className="admin-btn-link">Edit Campaign</Link>}</div>
          </div>)}{!data.campaigns.length && <Empty title="No referral campaigns yet" body="Create a deliberate campaign, choose its audience, and review the complete experience before launch." />}</div>
        </article>
        <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="border-b border-white/[0.07] p-5 sm:px-6"><h2 className="text-2xl font-light text-white">Recent referral activity</h2><p className="mt-1 text-sm text-white/35">Submissions and attribution decisions.</p></div>
          <div className="divide-y divide-white/[0.06]">{data.submissions.slice(0, 10).map(item => <Link key={item.id} href={`/admin/referral-studio/referrals/${item.id}`} className="block p-5 transition hover:bg-white/[0.025] sm:px-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-white/70">{item.firstName} {item.lastName}</p><p className="mt-1 text-xs text-white/30">Referred by {item.advocate?.client.displayName || "Manual attribution"} · {item.campaign.publicTitle}</p></div><span className={`rounded-full border px-2 py-1 text-[0.5rem] uppercase tracking-[.12em] ${statusTone(item.attributionStatus)}`}>{item.status.replaceAll("_", " ")}</span></div>
          </Link>)}{!data.submissions.length && <Empty title="No referral activity yet" body="Visits, submissions, qualification, and reward milestones will appear here." />}</div>
        </article>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-transparent p-6 sm:p-8">
        <p className="text-[0.58rem] font-semibold uppercase tracking-[.2em] text-[var(--helios-orange)]">Recommended advocates</p>
        <h2 className="mt-3 text-2xl font-light text-white">Recommendations remain advisory</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">AI-assisted recommendations use communication eligibility, group context, referral history, and legitimately available order activity. Every recommendation explains its reasoning and requires an administrator to include or dismiss it. No client is enrolled or contacted automatically.</p>
        <p className="mt-5 text-sm text-white/55">{data.clientCount} synced client records are available for eligibility review.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{recommendations.filter(item => !dismissed.has(item.id)).slice(0, 9).map(item => <article key={item.id} className="rounded-xl border border-white/[0.08] bg-[#111]/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-white/70">{item.displayName}</p><p className="mt-1 text-xs text-white/30">{item.groups.join(", ") || "No client group"}</p></div><span className={`text-xs ${item.eligible ? "text-emerald-200" : "text-amber-100"}`}>{item.score}%</span></div><p className="mt-3 text-xs leading-5 text-white/40">{item.reason}</p>{item.warnings.length > 0 && <ul className="mt-3 space-y-1 text-xs text-amber-100/60">{item.warnings.map(warning => <li key={warning}>• {warning}</li>)}</ul>}<p className="mt-3 text-[0.64rem] leading-5 text-white/25">{item.historyNote}</p><div className="mt-4 flex gap-2"><Link href={`/admin/referral-studio/campaigns/new?clientId=${encodeURIComponent(item.id)}`} className={`admin-btn-link ${!item.eligible ? "pointer-events-none opacity-40" : ""}`}>Include</Link><button className="admin-btn-link" type="button" onClick={() => setDismissed(current => new Set(current).add(item.id))}>Dismiss</button></div></article>)}</div>
      </section>
    </>}
  </div>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="p-8 text-center"><p className="text-sm text-white/55">{title}</p><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-white/30">{body}</p></div>;
}
