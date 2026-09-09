"use client";

import { useMemo, useState } from "react";
import type { PortfolioDiscoverySettings } from "@/lib/portfolio-discovery-settings";

type Option = { id: string; label: string };

export default function PortfolioDiscoverySettingsManager({ initialSettings, projects, media }: { initialSettings: PortfolioDiscoverySettings; projects: Option[]; media: Option[] }) {
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const excludedProjects = useMemo(() => new Set(settings.excludedProjectIds), [settings.excludedProjectIds]);
  const excludedMedia = useMemo(() => new Set(settings.excludedMediaIds), [settings.excludedMediaIds]);
  function toggle(field: "excludedProjectIds" | "excludedMediaIds", id: string) {
    setSettings((current) => ({ ...current, [field]: current[field].includes(id) ? current[field].filter((value) => value !== id) : [...current[field], id] }));
  }
  async function save() {
    setBusy(true); setMessage("Saving quick-browse settings…");
    try {
      const response = await fetch("/api/admin/portfolio-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save settings.");
      setMessage("Quick-browse settings saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save settings."); }
    finally { setBusy(false); }
  }
  const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white outline-none focus:border-[var(--helios-orange)]/60";
  return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
    <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow text-[var(--helios-orange)]">Portfolio Discovery</p><h2 className="mt-2 text-2xl font-normal text-white">Quick-browse galleries</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">Control the secondary photography and film experiences without changing curated project collections.</p></div><button type="button" disabled={busy} onClick={() => void save()} className="admin-btn-primary">{busy ? "Saving…" : "Save Gallery Settings"}</button></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <fieldset className="space-y-4 rounded-xl border border-white/[0.07] p-4"><legend className="px-2 text-sm text-white/70">Photography</legend><label className="flex min-h-11 items-center gap-3 text-sm text-white/55"><input type="checkbox" checked={settings.photoEnabled} onChange={(event) => setSettings({ ...settings, photoEnabled: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]"/>Enable All Photography Gallery</label><label className="block text-[0.55rem] uppercase tracking-[0.14em] text-white/35">Photography button label<input value={settings.photoButtonLabel} maxLength={80} onChange={(event) => setSettings({ ...settings, photoButtonLabel: event.target.value })} className={fieldClass}/></label><label className="block text-[0.55rem] uppercase tracking-[0.14em] text-white/35">Photography ordering<select value={settings.photoOrderingMode} onChange={(event) => setSettings({ ...settings, photoOrderingMode: event.target.value as PortfolioDiscoverySettings["photoOrderingMode"] })} className={fieldClass}><option value="ROTATING_MIX">Rotating mix</option><option value="CURATED">Curated</option><option value="NEWEST">Newest first</option></select></label></fieldset>
      <fieldset className="space-y-4 rounded-xl border border-white/[0.07] p-4"><legend className="px-2 text-sm text-white/70">Films</legend><label className="flex min-h-11 items-center gap-3 text-sm text-white/55"><input type="checkbox" checked={settings.filmEnabled} onChange={(event) => setSettings({ ...settings, filmEnabled: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]"/>Enable All Films Gallery</label><label className="block text-[0.55rem] uppercase tracking-[0.14em] text-white/35">Films button label<input value={settings.filmButtonLabel} maxLength={80} onChange={(event) => setSettings({ ...settings, filmButtonLabel: event.target.value })} className={fieldClass}/></label><label className="block text-[0.55rem] uppercase tracking-[0.14em] text-white/35">Films ordering<select value={settings.filmOrderingMode} onChange={(event) => setSettings({ ...settings, filmOrderingMode: event.target.value as PortfolioDiscoverySettings["filmOrderingMode"] })} className={fieldClass}><option value="ROTATING_MIX">Rotating mix</option><option value="CURATED">Curated</option><option value="NEWEST">Newest first</option></select></label></fieldset>
    </div>
    <label className="mt-6 block max-w-xs text-[0.55rem] uppercase tracking-[0.14em] text-white/35">Initial item count<input type="number" min={6} max={48} step={6} value={settings.initialItemCount} onChange={(event) => setSettings({ ...settings, initialItemCount: Number(event.target.value) })} className={fieldClass}/></label>
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><details className="rounded-xl border border-white/[0.07] p-4"><summary className="cursor-pointer text-sm text-white/60">Excluded projects · {excludedProjects.size}</summary><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{projects.map((item) => <label key={item.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm text-white/45 hover:bg-white/[0.03]"><input type="checkbox" checked={excludedProjects.has(item.id)} onChange={() => toggle("excludedProjectIds", item.id)} className="h-4 w-4 accent-[var(--helios-orange)]"/>{item.label}</label>)}</div></details><details className="rounded-xl border border-white/[0.07] p-4"><summary className="cursor-pointer text-sm text-white/60">Excluded individual assets · {excludedMedia.size}</summary><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{media.map((item) => <label key={item.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm text-white/45 hover:bg-white/[0.03]"><input type="checkbox" checked={excludedMedia.has(item.id)} onChange={() => toggle("excludedMediaIds", item.id)} className="h-4 w-4 accent-[var(--helios-orange)]"/>{item.label}</label>)}</div></details></div>
    {message ? <p role="status" className="mt-5 text-xs text-white/45">{message}</p> : null}
  </section>;
}
