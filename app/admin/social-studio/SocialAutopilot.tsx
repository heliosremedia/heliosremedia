"use client";

import Link from "next/link";
import { useState } from "react";

type Week = { id: string; weekStart: string; status: string; drafts: Array<{ id: string; pillar: string; campaign: { id: string; internalName: string; variants: Array<{ platform: string; status: string; scheduledAt: string | null }> } }> };

export default function SocialAutopilot({ initialEnabled, featureAvailable, queueBridgeAvailable, weeks }: { initialEnabled: boolean; featureAvailable: boolean; queueBridgeAvailable: boolean; weeks: Week[] }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function saveEnabled(next: boolean) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/social/autopilot/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }) });
    const data = await response.json();
    if (response.ok && data.success) { setEnabled(next); setMessage(next ? "Weekly generation enabled." : "Autopilot disabled. Existing social connections are unchanged."); }
    else setMessage(data.error || "Setting could not be saved.");
    setBusy(false);
  }
  async function generate() {
    setBusy(true); setMessage("Generating a review-only weekly plan…");
    const response = await fetch("/api/admin/social/autopilot", { method: "POST" });
    const data = await response.json();
    if (response.ok && data.success) window.location.reload();
    else { setMessage(data.error || "Weekly plan could not be generated."); setBusy(false); }
  }
  const latest = weeks[0];
  return <section className="rounded-2xl border border-white/[.08] bg-white/[.02] p-5 sm:p-6" aria-labelledby="autopilot-heading">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow text-[var(--helios-orange)]">Review-only automation</p><h2 id="autopilot-heading" className="mt-2 text-2xl font-light text-white">Weekly AI content plan</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Builds drafts from verified portfolio work. Nothing is approved, scheduled, or published automatically.</p></div><div className="flex flex-wrap gap-2"><button disabled={busy || !featureAvailable} onClick={generate} className="admin-btn-primary">Generate this week</button><button disabled={busy || !featureAvailable} onClick={() => saveEnabled(!enabled)} className="admin-btn-secondary">{enabled ? "Disable autopilot" : "Enable weekly plans"}</button></div></div>
    {!featureAvailable && <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[.05] p-4 text-sm text-amber-100/60">The generator is installed but disabled by the deployment feature flag. Meta connections remain untouched.</p>}
    {featureAvailable && !queueBridgeAvailable && <p className="mt-5 rounded-xl border border-white/[.08] p-4 text-sm text-white/45">Draft generation is available. The approved-draft queue bridge remains off for the staged rollout.</p>}
    {message && <p role="status" aria-live="polite" className="mt-4 text-sm text-white/55">{message}</p>}
    {latest && <div className="mt-6"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-light text-white">Week of {new Date(latest.weekStart).toLocaleDateString()}</h3><span className="text-[.6rem] uppercase tracking-[.14em] text-white/35">{latest.status.replaceAll("_", " ")}</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{latest.drafts.map((draft) => <Link key={draft.id} href={`/admin/social-studio/campaigns/${draft.campaign.id}`} className="rounded-xl border border-white/[.08] p-4 transition hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]"><span className="text-sm text-white/75">{draft.campaign.internalName}</span><span className="mt-2 block text-[.58rem] uppercase tracking-[.14em] text-white/30">{draft.pillar.replaceAll("_", " ")} · {draft.campaign.variants.map((variant) => `${variant.platform} ${variant.status.replaceAll("_", " ")}`).join(" · ")}</span></Link>)}</div></div>}
  </section>;
}
