"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Item = { id: string; campaignId: string; campaign: string; platform: string; postType: string; status: string; scheduledAt: string };
export default function SocialCalendar({ items }: { items: Item[] }) {
  const [view, setView] = useState<"month"|"week"|"agenda">("month");
  const [platform, setPlatform] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [cursor, setCursor] = useState(new Date());
  const [dragged, setDragged] = useState<Item | null>(null);
  const [message, setMessage] = useState("");
  const filtered = items.filter((item) => (platform === "ALL" || item.platform === platform) && (status === "ALL" || item.status === status));
  const days = useMemo(() => {
    const start = view === "month" ? new Date(cursor.getFullYear(), cursor.getMonth(), 1) : new Date(cursor);
    if (view === "week") start.setDate(start.getDate() - start.getDay());
    const count = view === "month" ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate() : 7;
    return Array.from({ length: count }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [cursor, view]);
  function move(direction: number) { const next = new Date(cursor); view === "month" ? next.setMonth(next.getMonth() + direction) : next.setDate(next.getDate() + 7 * direction); setCursor(next); }
  async function reschedule(item: Item, day: Date) {
    if (!confirm(`${item.status.replaceAll("_", " ")} content will move to ${day.toLocaleDateString()}. Keep its existing time?`)) return;
    const current = new Date(item.scheduledAt);
    const mountainTime = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "2-digit", minute: "2-digit", hour12: false }).format(current);
    const local = `${day.toLocaleDateString("en-CA")}T${mountainTime}`;
    const response = await fetch(`/api/admin/social/campaigns/${item.campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "schedule", variantId: item.id, scheduledLocal: local, timeZone: "America/Denver" }) });
    setMessage(response.ok ? "Schedule updated. Refreshing…" : "The schedule could not be updated.");
    if (response.ok) window.location.reload();
  }
  return <div className="space-y-7 pb-10"><section className="flex flex-col gap-5 border-b border-white/[.08] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/admin/social-studio" className="text-xs text-white/35">← Social Studio</Link><p className="eyebrow mt-5 text-[var(--helios-orange)]">Scheduling</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Content calendar</h1><p className="mt-3 text-sm text-white/40">All times are displayed in Helios Mountain Time.</p></div><div className="flex flex-wrap gap-2">{(["month","week","agenda"] as const).map((item) => <button key={item} onClick={() => setView(item)} className={view === item ? "admin-btn-primary" : "admin-btn-secondary"}>{item}</button>)}</div></section>
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button onClick={() => move(-1)} className="admin-btn-secondary" aria-label="Previous calendar period">←</button><button onClick={() => setCursor(new Date())} className="admin-btn-secondary">Today</button><button onClick={() => move(1)} className="admin-btn-secondary" aria-label="Next calendar period">→</button></div><p className="text-lg text-white/70">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p><div className="flex gap-2"><select aria-label="Filter by platform" className="rounded-xl border border-white/10 bg-[#111] px-3 text-xs text-white" value={platform} onChange={(e) => setPlatform(e.target.value)}><option>ALL</option>{["INSTAGRAM","FACEBOOK","LINKEDIN","TIKTOK"].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by status" className="rounded-xl border border-white/10 bg-[#111] px-3 text-xs text-white" value={status} onChange={(e) => setStatus(e.target.value)}><option>ALL</option>{["APPROVED","SCHEDULED","READY_TO_PUBLISH","PUBLISHED"].map((item) => <option key={item}>{item}</option>)}</select></div></div>
  {view === "agenda" ? <div className="divide-y divide-white/[.07] rounded-2xl border border-white/[.08] p-5">{filtered.map((item) => <CalendarItem key={item.id} item={item}/>)}</div> : <div className={`grid gap-px overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.08] ${view === "month" ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-7"}`}>{days.map((day) => { const matches = filtered.filter((item) => new Date(item.scheduledAt).toLocaleDateString("en-CA", { timeZone: "America/Denver" }) === day.toLocaleDateString("en-CA")); return <section key={day.toISOString()} aria-label={day.toDateString()} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) void reschedule(dragged, day); setDragged(null); }} className="min-h-36 bg-[#101012] p-3 focus-within:ring-1 focus-within:ring-[var(--helios-orange)]"><p className="text-xs text-white/35">{day.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}</p><div className="mt-3 space-y-2">{matches.map((item) => <div key={item.id} draggable onDragStart={() => setDragged(item)} className="rounded-lg border border-white/[.08] bg-white/[.04] p-2"><Link href={`/admin/social-studio/campaigns/${item.campaignId}?variant=${item.id}`}><span className="block text-[.58rem] uppercase text-[var(--helios-orange)]">{item.platform}</span><span className="mt-1 block truncate text-xs text-white/60">{item.campaign}</span><span className="mt-1 block text-[.55rem] text-white/25">{new Date(item.scheduledAt).toLocaleTimeString("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" })} · {item.status.replaceAll("_", " ")}</span></Link></div>)}</div></section>; })}</div>}
  {message && <p role="status" aria-live="polite" className="text-sm text-white/50">{message}</p>}<p className="text-xs leading-5 text-white/25">Drag scheduled items to another day or open one to edit its exact date and time. Moves require confirmation and preserve approval. Keyboard users have equivalent date/time controls in the editor.</p></div>;
}
function CalendarItem({ item }: { item: Item }) { return <Link href={`/admin/social-studio/campaigns/${item.campaignId}?variant=${item.id}`} className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[10rem_1fr_auto]"><span className="text-xs text-white/35">{new Date(item.scheduledAt).toLocaleString("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><span className="text-sm text-white/65">{item.campaign} · {item.platform}</span><span className="text-[.58rem] uppercase text-white/30">{item.status.replaceAll("_", " ")}</span></Link>; }
