"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Campaign = { id: string; internalName: string; status: string; updatedAt: string; variants: Array<{ id: string; platform: string; postType: string; status: string; scheduledAt: string | null }> };
type SourceOption = { id: string; label: string };

const platforms = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK"];
const objectives = ["Showcase a property", "Highlight photography", "Promote cinematic video", "Share educational guidance", "Promote a blog article", "Highlight a service", "Build brand awareness", "Share a company update", "Feature a client or partner", "Custom objective"];

export default function SocialDashboard({ campaigns, projects, blogs, newsletters, summary }: {
  campaigns: Campaign[]; projects: SourceOption[]; blogs: SourceOption[]; newsletters: SourceOption[];
  summary: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ internalName: "", sourceType: "PROJECT", sourceRecordId: "", purpose: "", objective: objectives[0], targetAudience: "", primaryMessage: "", callToAction: "", destinationLink: "", internalAiInstructions: "", platforms: ["INSTAGRAM", "FACEBOOK"] });
  const sourceOptions = useMemo(() => draft.sourceType === "PROJECT" || draft.sourceType === "PORTFOLIO_ITEM" ? projects : draft.sourceType === "BLOG" ? blogs : draft.sourceType === "NEWSLETTER" ? newsletters : [], [draft.sourceType, projects, blogs, newsletters]);
  async function create() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/social/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Campaign could not be created.");
      window.location.href = `/admin/social-studio/campaigns/${data.campaign.id}`;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Campaign could not be created."); setSaving(false); }
  }
  const input = "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]";
  return <>
    <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow text-[var(--helios-orange)]">Content operations</p><h1 className="mt-3 text-3xl font-light tracking-[-.03em] text-white sm:text-4xl">Social Studio</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Create platform-specific campaigns, review every post, schedule the work, and publish manually with confidence.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/admin/social-studio/calendar" className="admin-btn-secondary">Content calendar</Link><Link href="/admin/social-studio/settings" className="admin-btn-secondary">Voice & connections</Link><button onClick={() => setOpen(true)} className="admin-btn-primary">New campaign</button></div>
    </section>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-label="Social workflow summary">
      {Object.entries(summary).map(([label, value]) => <div key={label} className="rounded-xl border border-white/[.08] bg-white/[.025] p-4"><p className="text-[.58rem] uppercase tracking-[.15em] text-white/30">{label.replaceAll("_", " ")}</p><p className="mt-3 font-display text-3xl font-light text-white">{value}</p></div>)}
    </section>
    <section className="rounded-2xl border border-white/[.08] bg-white/[.02] p-5 sm:p-6">
      <div className="flex items-end justify-between"><div><p className="eyebrow text-[var(--helios-orange)]">Workspace</p><h2 className="mt-2 text-2xl font-light text-white">Recent campaigns</h2></div></div>
      <div className="mt-5 divide-y divide-white/[.07]">
        {campaigns.map((campaign) => <Link key={campaign.id} href={`/admin/social-studio/campaigns/${campaign.id}`} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"><span><span className="block text-sm text-white/75">{campaign.internalName}</span><span className="mt-1 block text-xs text-white/30">{campaign.variants.map((item) => item.platform).join(" · ")}</span></span><span className="text-[.6rem] uppercase tracking-[.14em] text-white/35">{campaign.status.replaceAll("_", " ")}</span><span className="text-xs text-white/25">{new Date(campaign.updatedAt).toLocaleDateString()}</span></Link>)}
        {!campaigns.length && <p className="py-9 text-center text-sm text-white/35">No social campaigns yet. Start with a project, article, newsletter, approved media, upload, or blank idea.</p>}
      </div>
    </section>
    <section className="rounded-2xl border border-white/[.08] bg-white/[.02] p-5 sm:p-6"><p className="eyebrow text-[var(--helios-orange)]">Content cadence</p><h2 className="mt-2 text-2xl font-light text-white">Coming week</h2><p className="mt-3 text-sm leading-6 text-white/40">Cadence reflects scheduled records only. Social Studio will not declare a posting rhythm healthy until goals are configured.</p><div className="mt-5 grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, index) => { const date = new Date(Date.now() + index * 86400000); const count = campaigns.flatMap((item) => item.variants).filter((item) => item.scheduledAt && new Date(item.scheduledAt).toDateString() === date.toDateString()).length; return <div key={index} className="rounded-xl border border-white/[.07] p-3 text-center"><p className="text-[.55rem] uppercase text-white/25">{date.toLocaleDateString("en-US", { weekday: "short" })}</p><p className="mt-2 text-lg text-white/70">{count}</p></div>; })}</div></section>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="new-social-title" className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-4 backdrop-blur">
      <div className="mx-auto my-5 max-w-4xl rounded-2xl border border-white/10 bg-[#121214] p-6 sm:p-8"><div className="flex justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Social Studio</p><h2 id="new-social-title" className="mt-2 text-3xl font-light text-white">Create campaign</h2></div><button disabled={saving} onClick={() => setOpen(false)} className="admin-btn-secondary">Close</button></div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="text-xs text-white/40">Internal campaign name<input className={input} value={draft.internalName} onChange={(e) => setDraft({ ...draft, internalName: e.target.value })}/></label><label className="text-xs text-white/40">Source type<select className={input} value={draft.sourceType} onChange={(e) => setDraft({ ...draft, sourceType: e.target.value, sourceRecordId: "" })}>{["PROJECT","PORTFOLIO_ITEM","MEDIA_LIBRARY","BLOG","NEWSLETTER","UPLOADED_IMAGE","UPLOADED_VIDEO","AI_GENERATED_IMAGE","BLANK"].map((item) => <option key={item}>{item}</option>)}</select></label>
      {sourceOptions.length > 0 && <label className="text-xs text-white/40 sm:col-span-2">Verified source<select className={input} value={draft.sourceRecordId} onChange={(e) => setDraft({ ...draft, sourceRecordId: e.target.value })}><option value="">Choose source…</option>{sourceOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      <label className="text-xs text-white/40 sm:col-span-2">Purpose or creative brief<textarea rows={4} className={input} value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}/></label><label className="text-xs text-white/40">Objective<select className={input} value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })}>{objectives.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs text-white/40">Audience<input className={input} value={draft.targetAudience} onChange={(e) => setDraft({ ...draft, targetAudience: e.target.value })}/></label>
      <label className="text-xs text-white/40 sm:col-span-2">Primary message<input className={input} value={draft.primaryMessage} onChange={(e) => setDraft({ ...draft, primaryMessage: e.target.value })}/></label><label className="text-xs text-white/40">Call to action<input className={input} value={draft.callToAction} onChange={(e) => setDraft({ ...draft, callToAction: e.target.value })}/></label><label className="text-xs text-white/40">Destination link<input className={input} value={draft.destinationLink} onChange={(e) => setDraft({ ...draft, destinationLink: e.target.value })}/></label>
      <fieldset className="sm:col-span-2"><legend className="text-xs text-white/40">Platforms</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{platforms.map((platform) => <label key={platform} className="flex items-center gap-2 rounded-xl border border-white/10 p-3 text-xs text-white/60"><input type="checkbox" checked={draft.platforms.includes(platform)} onChange={() => setDraft({ ...draft, platforms: draft.platforms.includes(platform) ? draft.platforms.filter((item) => item !== platform) : [...draft.platforms, platform] })}/>{platform}</label>)}</div></fieldset>
      <label className="text-xs text-white/40 sm:col-span-2">Internal AI instructions — never published<textarea rows={3} className={input} value={draft.internalAiInstructions} onChange={(e) => setDraft({ ...draft, internalAiInstructions: e.target.value })}/></label></div>
      {message && <p role="alert" className="mt-5 text-sm text-red-200">{message}</p>}<div className="mt-7 flex justify-end gap-3"><button disabled={saving} onClick={() => setOpen(false)} className="admin-btn-secondary">Cancel</button><button disabled={saving || !draft.internalName || !draft.platforms.length} onClick={create} className="admin-btn-primary">{saving ? "Creating…" : "Create campaign"}</button></div></div></div>}
  </>;
}
