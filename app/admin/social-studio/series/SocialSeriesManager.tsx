"use client";

import Link from "next/link";
import { useState } from "react";

type Series = { id: string; name: string; description: string; frequency: string; status: string; platforms: string[]; occurrences: number; campaigns: number; generationThrough: string | null };
const platforms = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "OTHER"];

export default function SocialSeriesManager({ series }: { series: Series[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ name: "", description: "", objective: "", platforms: ["INSTAGRAM", "FACEBOOK"], frequency: "WEEKLY", interval: 1, dayOfWeek: 2, dayOfMonth: 1, localTime: "09:00", timeZone: "America/Denver", startsAt: new Date().toLocaleDateString("en-CA"), endsAt: "", defaultTone: "", defaultCallToAction: "", promptGuidance: "" });
  const input = "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]";
  async function create() {
    setBusy("create"); setMessage("");
    const response = await fetch("/api/admin/social/series", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const data = await response.json();
    if (!response.ok || !data.success) { setMessage(data.error || "Series could not be created."); setBusy(""); return; }
    window.location.reload();
  }
  async function act(id: string, action: "archive" | "generate") {
    setBusy(id); setMessage("");
    const through = new Date(); through.setMonth(through.getMonth() + 6);
    const response = await fetch(`/api/admin/social/series/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, through: through.toISOString() }) });
    const data = await response.json();
    setMessage(response.ok ? action === "generate" ? `${data.created} new planned occurrence${data.created === 1 ? "" : "s"} added.` : "Series archived." : data.error || "The action failed.");
    setBusy("");
    if (response.ok) window.location.reload();
  }
  return <div className="space-y-7 pb-10">
    <section className="flex flex-col gap-5 border-b border-white/[.08] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/admin/social-studio" className="text-xs text-white/35">← Social Studio</Link><p className="eyebrow mt-5 text-[var(--helios-orange)]">Recurring planning</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Social Series</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Build reusable editorial rhythms. Occurrences are planning records only and are never published automatically.</p></div><button onClick={() => setOpen(true)} className="admin-btn-primary">New series</button></section>
    <section className="grid gap-4 lg:grid-cols-2">{series.map((item) => <article key={item.id} className="rounded-2xl border border-white/[.08] bg-white/[.02] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">{item.frequency.replaceAll("_", " ")}</p><h2 className="mt-2 text-2xl font-light text-white">{item.name}</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-[.58rem] uppercase tracking-[.14em] text-white/35">{item.status}</span></div><p className="mt-3 text-sm leading-6 text-white/40">{item.description || "No description supplied."}</p><div className="mt-5 flex flex-wrap gap-2">{item.platforms.map((platform) => <span key={platform} className="rounded-lg bg-white/[.05] px-2.5 py-1 text-[.58rem] text-white/40">{platform}</span>)}</div><p className="mt-5 text-xs text-white/30">{item.occurrences} planned occurrences · {item.campaigns} linked campaigns</p>{item.status === "ACTIVE" && <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy === item.id} onClick={() => act(item.id, "generate")} className="admin-btn-secondary">Plan next six months</button><button disabled={busy === item.id} onClick={() => act(item.id, "archive")} className="admin-btn-secondary">Archive</button></div>}</article>)}{!series.length && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center lg:col-span-2"><p className="text-sm text-white/40">No Social Series yet. Create a recurring structure for Featured Listings, Behind the Scenes, Agent Branding, market education, or another editorial theme.</p></div>}</section>
    {message && <p role="status" aria-live="polite" className="text-sm text-white/50">{message}</p>}
    {open && <div role="dialog" aria-modal="true" aria-labelledby="new-series-title" className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-4 backdrop-blur"><div className="mx-auto my-5 max-w-3xl rounded-2xl border border-white/10 bg-[#121214] p-6 sm:p-8"><div className="flex justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Reusable cadence</p><h2 id="new-series-title" className="mt-2 text-3xl font-light text-white">Create Social Series</h2></div><button onClick={() => setOpen(false)} className="admin-btn-secondary">Close</button></div><div className="mt-7 grid gap-5 sm:grid-cols-2">
      <label className="text-xs text-white/40 sm:col-span-2">Series name<input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></label>
      <label className="text-xs text-white/40 sm:col-span-2">Description<textarea className={input} rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}/></label>
      <label className="text-xs text-white/40">Frequency<select className={input} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}><option>WEEKLY</option><option>MONTHLY</option></select></label>
      <label className="text-xs text-white/40">Every<input type="number" min={1} max={52} className={input} value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: Number(e.target.value) })}/></label>
      {draft.frequency === "WEEKLY" ? <label className="text-xs text-white/40">Day of week<select className={input} value={draft.dayOfWeek} onChange={(e) => setDraft({ ...draft, dayOfWeek: Number(e.target.value) })}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label> : <label className="text-xs text-white/40">Day of month<input type="number" min={1} max={31} className={input} value={draft.dayOfMonth} onChange={(e) => setDraft({ ...draft, dayOfMonth: Number(e.target.value) })}/></label>}
      <label className="text-xs text-white/40">Local time<input type="time" className={input} value={draft.localTime} onChange={(e) => setDraft({ ...draft, localTime: e.target.value })}/></label>
      <label className="text-xs text-white/40">Start date<input type="date" className={input} value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}/></label>
      <label className="text-xs text-white/40">End date — optional<input type="date" className={input} value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}/></label>
      <fieldset className="sm:col-span-2"><legend className="text-xs text-white/40">Default platforms</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{platforms.map((platform) => <label key={platform} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 p-3 text-xs text-white/60"><input type="checkbox" checked={draft.platforms.includes(platform)} onChange={() => setDraft({ ...draft, platforms: draft.platforms.includes(platform) ? draft.platforms.filter((item) => item !== platform) : [...draft.platforms, platform] })}/>{platform}</label>)}</div></fieldset>
      <label className="text-xs text-white/40">Default tone<input className={input} value={draft.defaultTone} onChange={(e) => setDraft({ ...draft, defaultTone: e.target.value })}/></label>
      <label className="text-xs text-white/40">Default call to action<input className={input} value={draft.defaultCallToAction} onChange={(e) => setDraft({ ...draft, defaultCallToAction: e.target.value })}/></label>
      <label className="text-xs text-white/40 sm:col-span-2">Reusable content guidance<textarea className={input} rows={4} value={draft.promptGuidance} onChange={(e) => setDraft({ ...draft, promptGuidance: e.target.value })}/></label>
    </div><p className="mt-5 text-xs leading-5 text-white/30">Creating a series plans the first three months. It creates internal occurrences only—no social account receives content.</p><div className="mt-7 flex justify-end gap-3"><button onClick={() => setOpen(false)} className="admin-btn-secondary">Cancel</button><button disabled={busy === "create" || !draft.name || !draft.platforms.length} onClick={create} className="admin-btn-primary">{busy === "create" ? "Creating…" : "Create series"}</button></div></div></div>}
  </div>;
}
