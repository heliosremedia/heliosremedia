"use client";

import AdminCardHeading from "@/app/admin/components/AdminCardHeading";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PropertySummary = { siteId: number; title: string; city: string; state: string };
type Property = PropertySummary & { photos: { mediaId: number; name: string }[] };
export default function HDPhotoHubImport({ targetProjectId }: { targetProjectId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PropertySummary[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  async function search(offset = 0) {
    setBusy(true); setError(""); setProperty(null); setProjectId(""); setStatus("Searching properties…");
    try {
      const response = await fetch(`/api/admin/projects/hdph-import?query=${encodeURIComponent(query.trim())}&offset=${offset}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Property search failed.");
      setResults(previous => offset ? [...previous, ...result.sites] : result.sites); setNextOffset(result.nextOffset);
      setStatus(result.sites.length ? "Select a property to check which photos HDPhotoHub permits this connection to retrieve." : "No matching delivered properties found.");
    } catch (e) { setError(e instanceof Error ? e.message : "Property search failed."); setStatus(""); }
    finally { setBusy(false); }
  }
  const [property, setProperty] = useState<Property | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [completed, setCompleted] = useState(false);
  async function lookup(siteId: number) {
    setBusy(true); setError(""); setProperty(null); setProjectId(""); setSelected([]); setRights(false); setCompleted(false); setStatus("Checking HDPhotoHub…");
    try {
      const response = await fetch(`/api/admin/projects/hdph-import?siteId=${encodeURIComponent(String(siteId))}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Property lookup failed.");
      setProperty(result); setStatus(`${result.photos.length} eligible photos. Choose what to copy, or import property details only.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Property lookup failed."); setStatus(""); }
    finally { setBusy(false); }
  }
  async function run() {
    if (!property || !rights || busy) return;
    setBusy(true); setError(""); setCompleted(false);
    let imported = 0, existing = 0;
    const post = async (body: object) => {
      const response = await fetch("/api/admin/projects/hdph-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, siteId: property.siteId, targetProjectId, rightsConfirmed: rights }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Import failed.");
      return result;
    };
    try {
      setStatus("Creating or resuming draft…");
      const draft = await post({ action: "draft" }); setProjectId(draft.projectId);
      for (let i = 0; i < selected.length; i++) { setStatus(`Copying photo ${i + 1} of ${selected.length}…`); const result = await post({ action: "photo", mediaId: selected[i] }); if (result.alreadyImported) existing++; else imported++; }
      if (targetProjectId) window.dispatchEvent(new CustomEvent("helios:project-media-updated", { detail: { projectId: targetProjectId } }));
      router.refresh();
      setCompleted(true);
      setStatus(`Import complete. ${imported} photo${imported === 1 ? "" : "s"} added${existing ? `; ${existing} already in this draft (not duplicated)` : ""}. Nothing was published. Next: open Media to choose your lead image.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed."); if (targetProjectId && imported) window.dispatchEvent(new CustomEvent("helios:project-media-updated", { detail: { projectId: targetProjectId } })); setStatus(`Import stopped after ${imported} new photos. Nothing was published. Retry to resume without duplicates.`); }
    finally { setBusy(false); }
  }
  return <details className="group/import rounded-2xl border border-white/10 bg-[#111]">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)] [&::-webkit-details-marker]:hidden"><span className="min-w-0 flex-1"><AdminCardHeading inline eyebrow="Optional import" title="Populate from HD Photo Hub" description={`${targetProjectId ? "Add selected photos and fill empty location fields. Existing details are preserved." : "Copy a delivered property into a new Studio draft."} HDPhotoHub stays unchanged, and nothing is published. Manual editing is always available.`} /></span><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl font-light text-white/70"><span className="group-open/import:hidden">+</span><span className="hidden group-open/import:inline">−</span></span></summary>
    <div className="space-y-4 border-t border-white/10 p-5">

      <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1"><span className="block text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]">Search Address</span><input value={query} onChange={e => { setQuery(e.target.value); setResults([]); setNextOffset(null); setProperty(null); setProjectId(""); setStatus(""); }} disabled={busy} placeholder="Start typing a street address" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white" /></label><button type="button" className="admin-btn-secondary" onClick={() => search()} disabled={busy || query.trim().length < 3}>Search HDPhotoHub</button></div>
      {!!results.length && <ul className="max-h-64 space-y-2 overflow-auto">{results.map(site => <li key={site.siteId}><button type="button" disabled={busy} onClick={() => lookup(site.siteId)} className="w-full rounded-xl border border-white/10 p-3 text-left text-sm text-white hover:border-orange-400">{site.title} · {[site.city,site.state].filter(Boolean).join(", ")}<span className="ml-2 text-xs text-white/40">#{site.siteId}</span></button></li>)}</ul>}
      {nextOffset != null && <button type="button" disabled={busy} className="admin-btn-secondary" onClick={() => search(nextOffset)}>More properties</button>}
      {property && <>
        <p className="text-white">{property.title}<span className="ml-2 text-sm text-white/50">{[property.city,property.state].filter(Boolean).join(", ")}</span></p>
        <p className="text-xs text-white/45">Property title, location and internal property address are copied. Listing descriptions, contacts, private notes, videos, and hidden or restricted photos are not imported.</p>
        {!!property.photos.length && <><button type="button" className="admin-btn-link" disabled={busy} onClick={() => { setCompleted(false); setSelected(selected.length === property.photos.length ? [] : property.photos.map(p => p.mediaId)); }}>{selected.length === property.photos.length ? "Clear photo selection" : "Select all eligible photos"}</button><div className="grid max-h-60 gap-2 overflow-auto sm:grid-cols-2">{property.photos.map(photo => <label key={photo.mediaId} className="flex items-center gap-2 text-sm text-white/65"><input type="checkbox" disabled={busy} checked={selected.includes(photo.mediaId)} onChange={e => { setCompleted(false); setSelected(ids => e.target.checked ? [...ids,photo.mediaId] : ids.filter(id => id !== photo.mediaId)); }} />{photo.name}</label>)}</div></>}
        <label className="flex items-start gap-2 text-sm text-white/60"><input type="checkbox" className="mt-1" checked={rights} disabled={busy} onChange={e => setRights(e.target.checked)} />I have permission to copy this property and the selected photos into Helios Studio storage. I will review publication separately.</label>
        <button type="button" className="admin-btn-primary" disabled={busy || !rights || completed} onClick={run}>{completed ? "Import complete" : busy ? "Importing…" : `${targetProjectId ? "Populate this draft" : "Create / resume draft"}${selected.length ? ` + ${selected.length} photos` : ""}`}</button>
      </>}
      {status && <p role="status" className="text-sm text-white/60">{status}</p>}
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      {projectId && !busy && (targetProjectId ? <div className="space-y-2"><button type="button" className="admin-btn-primary" onClick={() => { const section = document.getElementById("project-media"); const toggle = section?.querySelector<HTMLButtonElement>("button[aria-expanded]"); if (toggle?.getAttribute("aria-expanded") === "false") toggle.click(); requestAnimationFrame(() => { section?.scrollIntoView({ behavior: "smooth", block: "start" }); section?.focus({ preventScroll: true }); }); }}>View imported photos in Media</button><p className="text-xs text-white/50">Your other unsaved edits stay in place. Choose a lead image, then review before publishing.</p></div> : <Link href={`/admin/projects/${projectId}`} className="admin-btn-secondary">Open imported draft</Link>)}
      {busy && <p className="text-xs text-white/40">Keep this page open until copying finishes. If interrupted, repeat this import to resume without duplicates.</p>}
    </div>
  </details>;
}
