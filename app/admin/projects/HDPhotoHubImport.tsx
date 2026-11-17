"use client";

import PhotoImportProgress, { type PhotoImportProgressValue } from "./PhotoImportProgress";

import AdminCardHeading from "@/app/admin/components/AdminCardHeading";

import { hdphDetailConflicts, type HDPHDetailValues } from "@/lib/project-hdph-conflicts";
import Link from "next/link";
import { useProjectRefreshInPlace } from "./useProjectRefreshInPlace";
import { viewImportedProjectPhotos } from "@/lib/project-import-navigation";
import { useState } from "react";

type PropertySummary = { siteId: number; title: string; city: string; state: string };
export type HDPHSelectedProperty = PropertySummary & { propertyAddress: string; locationLabel: string };
type Property = HDPHSelectedProperty & { photos: { mediaId: number; name: string; alreadyImported?: boolean }[] };
function ImportPhotoTile({ siteId, photo, selected, disabled, onChange }: { siteId: number; photo: { mediaId: number; name: string; alreadyImported?: boolean }; selected: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  const [failed, setFailed] = useState(false);
  return <label className={`relative min-w-0 cursor-pointer overflow-hidden rounded-xl border bg-black/20 transition focus-within:ring-2 focus-within:ring-[var(--helios-orange)] ${selected || photo.alreadyImported ? "border-emerald-400/70" : "border-white/15"} ${photo.alreadyImported ? "cursor-default opacity-70" : disabled ? "cursor-wait opacity-60" : "hover:border-white/40"}`}>
    <input type="checkbox" className="peer sr-only" checked={selected || !!photo.alreadyImported} disabled={disabled || photo.alreadyImported} aria-label={`${photo.alreadyImported ? "Already imported:" : "Select"} ${photo.name}`} onChange={event => onChange(event.target.checked)} />
    <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white/[0.025]">
      {failed ? <span className="px-3 text-center text-xs text-white/50">Preview unavailable<br />{photo.alreadyImported ? "Already in this project" : "You can still select this photo"}</span> :
        // Same-origin authenticated preview. Provider credentials and rendition URLs stay server-side.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/admin/projects/hdph-import/thumbnail?siteId=${siteId}&mediaId=${photo.mediaId}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" onError={() => setFailed(true)} />}
    </span>
    <span aria-hidden="true" className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold shadow ${selected || photo.alreadyImported ? "border-emerald-300 bg-emerald-500 text-black" : "border-white/60 bg-black/50 text-transparent"}`}>✓</span>
    {photo.alreadyImported && <span className="block px-3 pt-2 text-xs font-semibold text-emerald-300">Already imported</span>}
    <span className="block truncate px-3 py-2 text-xs text-white/60" title={photo.name}>{photo.name}</span>
  </label>;
}
export default function HDPhotoHubImport({ targetProjectId, initialSiteId, onSelectProperty, currentDetails = {} }: { targetProjectId?: string; initialSiteId?: number | null; currentDetails?: HDPHDetailValues; onSelectProperty?: (property: HDPHSelectedProperty, replaceDetails: boolean) => void }) {
  const refreshInPlace = useProjectRefreshInPlace();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PropertySummary[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  async function search(offset = 0) {
    setProgress(null);
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
  const availablePhotos = property?.photos.filter(photo => !photo.alreadyImported) ?? [];
  const [selected, setSelected] = useState<number[]>([]);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [replacementChoice, setReplacementChoice] = useState("");
  const conflicts = property ? hdphDetailConflicts(currentDetails, property) : [];
  const replacementKey = property && conflicts.length ? JSON.stringify([property.siteId, currentDetails, property.title, property.city, property.state, property.locationLabel, property.propertyAddress]) : "";
  const replaceDetails = Boolean(replacementKey && replacementChoice === replacementKey);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState<PhotoImportProgressValue | null>(null);
  async function lookup(siteId: number) {
    setReplacementChoice("");
    setProgress(null);
    setBusy(true); setError(""); setProperty(null); setProjectId(""); setSelected([]); setRights(false); setCompleted(false); setStatus("Checking HDPhotoHub…");
    try {
      const response = await fetch(`/api/admin/projects/hdph-import?siteId=${encodeURIComponent(String(siteId))}${targetProjectId ? `&targetProjectId=${encodeURIComponent(targetProjectId)}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Property lookup failed.");
      setProperty(result); setStatus(onSelectProperty ? "Review this property and use its details below. Photos are selected later in Media." : `${result.photos.filter((photo: { alreadyImported?: boolean }) => !photo.alreadyImported).length} new photos available; ${result.photos.filter((photo: { alreadyImported?: boolean }) => photo.alreadyImported).length} already imported.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Property lookup failed."); setStatus(""); }
    finally { setBusy(false); }
  }
  async function run() {
    if (!property || !rights || busy) return;
    if (!selected.length) return;
    const total = selected.length;
    setProgress({ total, done: 0, state: "running" });
    setBusy(true); setError(""); setCompleted(false);
    let imported = 0, existing = 0;
    const post = async (body: object) => {
      const response = await fetch("/api/admin/projects/hdph-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, siteId: property.siteId, targetProjectId, rightsConfirmed: rights }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Import failed.");
      return result;
    };
    try {
      setStatus("Preparing photo import…");
      const draft = await post({ action: "link" }); setProjectId(draft.projectId);
      setStatus(`Copying ${selected.length} selected photos… Keep this page open.`);
      for (const mediaId of selected) {
        const result = await post({ action: "photo", mediaId });
        if (result.alreadyImported) existing++; else imported++;
        setProgress({ total, done: imported + existing, state: "running" });
        setProperty(current => current ? { ...current, photos: current.photos.map(photo => photo.mediaId === mediaId ? { ...photo, alreadyImported: true } : photo) } : current);
        setSelected(ids => ids.filter(id => id !== mediaId));
        setStatus(`${imported + existing} of ${selected.length} photos ready…`);
      }
      if (targetProjectId) window.dispatchEvent(new CustomEvent("helios:project-media-updated", { detail: { projectId: targetProjectId } }));
      refreshInPlace();
      setCompleted(true);
      setProgress({ total, done: imported + existing, state: "complete" });
      setStatus(`Import complete. ${imported} photo${imported === 1 ? "" : "s"} added${existing ? `; ${existing} already in this draft (not duplicated)` : ""}. Nothing was published. Next: open Media to choose your lead image.`);
    } catch (e) { setProgress({ total, done: imported + existing, state: "stopped" }); setError(e instanceof Error ? e.message : "Import failed."); if (targetProjectId && imported) window.dispatchEvent(new CustomEvent("helios:project-media-updated", { detail: { projectId: targetProjectId } })); if (imported) refreshInPlace(); setStatus(`Import stopped after ${imported} new photos. Nothing was published. Retry to resume without duplicates.`); }
    finally { setBusy(false); }
  }
  return <details className="group/import rounded-2xl border border-white/10 bg-[#111]">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)] [&::-webkit-details-marker]:hidden"><span className="min-w-0 flex-1"><AdminCardHeading inline eyebrow="Optional import" title="Populate from HD Photo Hub" description={`${targetProjectId ? "Import selected photos from your linked property. Existing project details are preserved." : "Choose a delivered property to fill the project identity and location. Photos come later in Media."} HDPhotoHub stays unchanged, and nothing is published. Manual editing is always available.`} /></span><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl font-light text-white/70"><span className="group-open/import:hidden">+</span><span className="hidden group-open/import:inline">−</span></span></summary>
    <div className="space-y-4 border-t border-white/10 p-5">

      {initialSiteId && !property && <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => lookup(initialSiteId)}>Load photos from selected HDPhotoHub property #{initialSiteId}</button>}
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1"><span className="block text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]">Search Address</span><input value={query} onChange={e => { setProgress(null); setQuery(e.target.value); setResults([]); setNextOffset(null); setProperty(null); setProjectId(""); setStatus(""); }} disabled={busy} placeholder="Start typing a street address" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white" /></label><button type="button" className="admin-btn-secondary" onClick={() => search()} disabled={busy || query.trim().length < 3}>Search HDPhotoHub</button></div>
      {!!results.length && <ul className="max-h-64 space-y-2 overflow-auto">{results.map(site => <li key={site.siteId}><button type="button" disabled={busy} onClick={() => lookup(site.siteId)} className="w-full rounded-xl border border-white/10 p-3 text-left text-sm text-white hover:border-orange-400">{site.title} · {[site.city,site.state].filter(Boolean).join(", ")}<span className="ml-2 text-xs text-white/40">#{site.siteId}</span></button></li>)}</ul>}
      {nextOffset != null && <button type="button" disabled={busy} className="admin-btn-secondary" onClick={() => search(nextOffset)}>More properties</button>}
      {property && <>
        <p className="text-white">{property.title}<span className="ml-2 text-sm text-white/50">{[property.city,property.state].filter(Boolean).join(", ")}</span></p>
        <p className="text-xs text-white/45">{onSelectProperty ? "Title, location and internal address fill the form for your review. Photos are not imported at this step." : "Only selected photos are added. Your project identity and other edits stay unchanged."} Listing descriptions, contacts, private notes, videos, and hidden or restricted photos are not imported.</p>
        {onSelectProperty ? <div className="space-y-4 pt-4">
          {!!conflicts.length && <label className="flex items-start gap-2 text-sm text-white/60"><input type="checkbox" className="mt-1" checked={replaceDetails} disabled={busy} onChange={event => setReplacementChoice(event.target.checked ? replacementKey : "")} />Replace my existing title or location entries that differ from this property. Leave unchecked to keep them and fill only empty fields.</label>}
          <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => { onSelectProperty(property, replaceDetails); setReplacementChoice(""); setStatus("Property details filled in. Review them and create your draft, then select photos in Media. No photos have been imported."); }}>Use property details</button>
        </div> : <>
        {!!property.photos.length && <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-white/65">{selected.length} of {availablePhotos.length} new photos selected</span>
            <button type="button" className="admin-btn-secondary" disabled={busy || !availablePhotos.length} onClick={() => { setProgress(null); setCompleted(false); setSelected(selected.length === availablePhotos.length ? [] : availablePhotos.map(p => p.mediaId)); }}>{selected.length === availablePhotos.length && availablePhotos.length > 0 ? "Clear selection" : "Select all new photos"}</button>
          </div>
          <div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Photos available to import">
            {property.photos.map(photo => <ImportPhotoTile key={`${property.siteId}:${photo.mediaId}`} siteId={property.siteId} photo={photo} selected={selected.includes(photo.mediaId)} disabled={busy} onChange={checked => { setProgress(null); setCompleted(false); setSelected(ids => checked ? [...ids, photo.mediaId] : ids.filter(id => id !== photo.mediaId)); }} />)}
          </div>
        </div>}
        <label className="flex items-start gap-2 text-sm text-white/60"><input type="checkbox" className="mt-1" checked={rights} disabled={busy} onChange={e => setRights(e.target.checked)} />I have permission to copy this property and the selected photos into Helios Studio storage. I will review publication separately.</label>
        <button type="button" className="admin-btn-primary" disabled={busy || !rights || completed || !selected.length} onClick={run}>{completed ? "Import complete" : busy ? "Importing…" : `Import ${selected.length} selected photo${selected.length === 1 ? "" : "s"}`}</button>
        </>}
      </>}
      {progress && <PhotoImportProgress value={progress} />}
      {status && <p role="status" className="text-sm text-white/60">{status}</p>}
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      {projectId && !busy && (targetProjectId ? <div className="space-y-2"><button type="button" className="admin-btn-primary" onClick={viewImportedProjectPhotos}>View imported photos in Media</button><p className="text-xs text-white/50">Your other unsaved edits stay in place. Choose a lead image, then review before publishing.</p></div> : <Link href={`/admin/projects/${projectId}`} className="admin-btn-secondary">Open imported draft</Link>)}
      {busy && <p className="text-xs text-white/40">Keep this page open until copying finishes. If interrupted, repeat this import to resume without duplicates.</p>}
    </div>
  </details>;
}
