"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { AI_LOCATION_FIELDS, LOCATION_FIELD_LIMITS, type EditableLocationField } from "@/lib/location-page-content";

export type AdminLocationPage = {
  id: string;
  slug: string;
  city: string;
  state: string;
  county: string;
  seoTitle: string;
  seoDescription: string;
  heroLead: string;
  introduction: string;
  marketTitle: string;
  marketCopy: string;
  localDetails: string[];
  serviceArea: string;
  ctaHeadline: string | null;
  featureImageStorageKey: string | null;
  featureImageUrl: string | null;
  featureImageAlt: string | null;
  featureImageFocalX: number;
  featureImageFocalY: number;
  published: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

type Draft = Omit<AdminLocationPage, "id" | "published" | "displayOrder" | "createdAt" | "updatedAt">;

const emptyBuilder = {
  city: "",
  state: "Colorado",
  county: "",
  nearbyCommunities: "",
};

function toDraft(location: AdminLocationPage): Draft {
  return {
    slug: location.slug,
    city: location.city,
    state: location.state,
    county: location.county,
    seoTitle: location.seoTitle,
    seoDescription: location.seoDescription,
    heroLead: location.heroLead,
    introduction: location.introduction,
    marketTitle: location.marketTitle,
    marketCopy: location.marketCopy,
    localDetails: location.localDetails,
    serviceArea: location.serviceArea,
    ctaHeadline: location.ctaHeadline,
    featureImageStorageKey: location.featureImageStorageKey,
    featureImageUrl: location.featureImageUrl,
    featureImageAlt: location.featureImageAlt,
    featureImageFocalX: location.featureImageFocalX,
    featureImageFocalY: location.featureImageFocalY,
  };
}

function Field({
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
  help?: string;
}) {
  const classes = "mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55";
  const overLimit = value.length > maxLength;
  const helpId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-help`;
  return (
    <label className="block">
      <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/42">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} aria-invalid={overLimit} aria-describedby={helpId} className={`${classes} resize-y ${overLimit ? "border-red-300/60" : ""}`} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={overLimit} aria-describedby={helpId} className={`${classes} ${overLimit ? "border-red-300/60" : ""}`} />
      )}
      <span id={helpId} className={`mt-1.5 flex justify-between gap-3 text-[0.58rem] ${overLimit ? "text-red-200/80" : "text-white/22"}`}>
        <span>{help}</span><span>{value.length}/{maxLength}</span>
      </span>
    </label>
  );
}

export default function LocationPageManager({ initialLocations }: { initialLocations: AdminLocationPage[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [builder, setBuilder] = useState(emptyBuilder);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState<AdminLocationPage | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [customDirection, setCustomDirection] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<Partial<Record<EditableLocationField, string>> | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  function replaceLocation(location: AdminLocationPage) {
    setLocations((current) => current.map((item) => item.id === location.id ? location : item));
  }

  async function buildPage() {
    if (!builder.city.trim() || !builder.county.trim()) {
      setError("Enter the city and county so the page can be built accurately.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", ...builder }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.location) throw new Error(data.error || "The page could not be built.");
      const location = data.location as AdminLocationPage;
      setLocations((current) => [...current, location]);
      setBuilder(emptyBuilder);
      setShowBuilder(false);
      setEditing(location);
      setDraft(toDraft(location));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page could not be built.");
    } finally { setBusy(false); }
  }

  async function savePage() {
    if (!editing || !draft) return;
    const lengthErrors = Object.entries(LOCATION_FIELD_LIMITS).filter(([key, limit]) => key in draft && typeof draft[key as keyof Draft] === "string" && String(draft[key as keyof Draft] || "").length > limit);
    if (lengthErrors.length) { setError("One or more fields exceed their character limit. Shorten the highlighted fields before saving."); return; }
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", locationId: editing.id, ...draft }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.location) throw new Error(data.error || "The page could not be saved.");
      replaceLocation(data.location);
      setEditing(null); setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page could not be saved.");
    } finally { setBusy(false); }
  }

  async function generateDraft() {
    if (!editing || !draft || aiBusy) return;
    setAiBusy(true); setAiMessage("Generating a locally specific draft…"); setAiDraft(null);
    try {
      const response = await fetch("/api/admin/locations/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: editing.id, city: draft.city, customDirection }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The assistant could not generate a draft.");
      setAiDraft(data.draft); setAiMessage("Draft ready. Apply only the fields you want, then use Save draft.");
    } catch (caught) { setAiMessage(caught instanceof Error ? caught.message : "The assistant could not generate a draft."); }
    finally { setAiBusy(false); }
  }

  function applyAiField(field: EditableLocationField) {
    if (!draft || !aiDraft?.[field]) return;
    setDraft({ ...draft, [field]: aiDraft[field] });
  }

  function applyAiDraft() {
    if (!draft || !aiDraft) return;
    setDraft({ ...draft, ...aiDraft });
    setAiMessage("Complete draft applied locally. Review it and use Save draft when ready.");
  }

  async function uploadFeatureImage(file: File) {
    if (!editing || !draft) return;
    setUploadBusy(true); setError(null);
    try {
      const prepared = await fetch("/api/admin/locations/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: editing.id, fileName: file.name, fileType: file.type, fileSize: file.size }) });
      const data = await prepared.json();
      if (!prepared.ok || !data.success) throw new Error(data.error || "The image upload could not be prepared.");
      const uploaded = await fetch(data.upload.uploadUrl, { method: "PUT", headers: { "Content-Type": data.upload.contentType }, body: file });
      if (!uploaded.ok) throw new Error("The image could not be uploaded.");
      setDraft({ ...draft, featureImageStorageKey: data.upload.key, featureImageUrl: data.upload.publicUrl });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The image could not be uploaded."); }
    finally { setUploadBusy(false); }
  }

  async function togglePublished(location: AdminLocationPage) {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", locationId: location.id, published: !location.published }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.location) throw new Error(data.error || "The page status could not be changed.");
      replaceLocation(data.location);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page status could not be changed.");
    } finally { setBusy(false); }
  }

  async function reorder(location: AdminLocationPage, direction: "up" | "down") {
    const index = locations.findIndex((item) => item.id === location.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= locations.length) return;
    const next = [...locations];
    [next[index], next[target]] = [next[target], next[index]];
    setLocations(next);
    const response = await fetch("/api/admin/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", locationId: location.id, direction }),
    });
    if (!response.ok) {
      setLocations(locations);
      const data = await response.json();
      setError(data.error || "The page order could not be saved.");
    }
  }

  async function remove(location: AdminLocationPage) {
    if (!window.confirm(`Permanently delete the ${location.city} local page? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/locations?locationId=${encodeURIComponent(location.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The page could not be deleted.");
      setLocations((current) => current.filter((item) => item.id !== location.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page could not be deleted.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg text-white">{locations.length} local {locations.length === 1 ? "page" : "pages"}</p>
            <p className="mt-1 text-xs text-white/30">{locations.filter((item) => item.published).length} published · {locations.filter((item) => !item.published).length} drafts</p>
          </div>
          <button type="button" onClick={() => { setShowBuilder(true); setError(null); }} className="admin-btn-primary">
            Build a local page
          </button>
        </div>
        {error ? <p className="mt-5 rounded-xl border border-red-300/15 bg-red-300/[0.05] px-4 py-3 text-sm text-red-200/75">{error}</p> : null}
      </section>

      <div className="space-y-3">
        {locations.map((location, index) => (
          <article key={location.id} className="grid gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
            <div className="flex gap-2">
              <button type="button" disabled={index === 0 || busy} onClick={() => reorder(location, "up")} aria-label={`Move ${location.city} up`} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/35 disabled:opacity-20">↑</button>
              <button type="button" disabled={index === locations.length - 1 || busy} onClick={() => reorder(location, "down")} aria-label={`Move ${location.city} down`} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/35 disabled:opacity-20">↓</button>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl text-white">{location.city}, {location.state}</h2>
                <span className={`rounded-full border px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.14em] ${location.published ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/70" : "border-amber-300/15 bg-amber-300/[0.05] text-amber-100/60"}`}>{location.published ? "Published" : "Draft"}</span>
              </div>
              <p className="mt-1.5 text-xs text-white/25">/locations/{location.slug} · {location.county}</p>
              <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-white/40">{location.heroLead}</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {location.published ? <Link href={`/locations/${location.slug}`} target="_blank" className="admin-btn-secondary">View</Link> : null}
              <button type="button" disabled={busy} onClick={() => { setEditing(location); setDraft(toDraft(location)); setError(null); setAssistantOpen(false); setAiDraft(null); setAiMessage(null); setCustomDirection(""); }} className="admin-btn-secondary">Edit</button>
              <button type="button" disabled={busy} onClick={() => togglePublished(location)} className="admin-btn-primary">{location.published ? "Unpublish" : "Publish"}</button>
              <button type="button" disabled={busy} onClick={() => remove(location)} className="px-3 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-red-200/35 transition hover:text-red-200">Delete</button>
            </div>
          </article>
        ))}
      </div>

      {showBuilder ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-8">
          <div role="dialog" aria-modal="true" aria-labelledby="builder-title" className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl sm:p-8">
            <p className="eyebrow text-[var(--helios-orange)]">Automated starter</p>
            <h2 id="builder-title" className="mt-3 text-3xl font-light text-white">Build a local page</h2>
            <p className="mt-3 text-sm leading-6 text-white/40">The system will create the URL, metadata, headlines, page copy, local-focus list, and service-area language. It stays in draft until you review and publish it.</p>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <Field label="City" value={builder.city} onChange={(city) => setBuilder((current) => ({ ...current, city }))} maxLength={100} />
              <Field label="State" value={builder.state} onChange={(state) => setBuilder((current) => ({ ...current, state }))} maxLength={100} />
              <Field label="County or market" value={builder.county} onChange={(county) => setBuilder((current) => ({ ...current, county }))} maxLength={140} help="Example: Boulder County" />
              <Field label="Nearby communities" value={builder.nearbyCommunities} onChange={(nearbyCommunities) => setBuilder((current) => ({ ...current, nearbyCommunities }))} maxLength={300} help="Comma-separated; optional" />
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" disabled={busy} onClick={() => setShowBuilder(false)} className="admin-btn-secondary">Cancel</button>
              <button type="button" disabled={busy} onClick={buildPage} className="admin-btn-primary">{busy ? "Building…" : "Build draft"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {editing && draft ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-8">
          <div role="dialog" aria-modal="true" aria-labelledby="editor-title" className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-6">
              <div><p className="eyebrow text-[var(--helios-orange)]">Local page editor</p><h2 id="editor-title" className="mt-3 text-3xl font-light text-white">{editing.city}</h2></div>
              <button type="button" onClick={() => { setEditing(null); setDraft(null); setAiDraft(null); }} className="text-2xl text-white/35 hover:text-white" aria-label="Close editor">×</button>
            </div>
            <section className="mt-8 rounded-2xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.035] p-5 sm:p-6" aria-labelledby="location-assistant-title">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="eyebrow text-[var(--helios-orange)]">Write with AI</p><h3 id="location-assistant-title" className="mt-2 text-2xl font-light text-white">Location Page Assistant</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">Create a locally specific draft using this location, your company services, and any direction you provide. Review every field before saving or publishing.</p></div>
                <button type="button" aria-expanded={assistantOpen} aria-controls="location-assistant-panel" onClick={() => setAssistantOpen((open) => !open)} className="admin-btn-secondary">{assistantOpen ? "Close assistant" : "Open assistant"}</button>
              </div>
              {assistantOpen ? <div id="location-assistant-panel" className="mt-6 border-t border-white/10 pt-6">
                <label className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/42">Custom direction <span className="normal-case tracking-normal text-white/25">(optional)</span><textarea value={customDirection} onChange={(event) => setCustomDirection(event.target.value)} rows={4} aria-invalid={customDirection.length > LOCATION_FIELD_LIMITS.customDirection} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]/55" placeholder="Emphasize authentic local distinctions, architecture, landscape, or the uploaded image." /></label>
                <div className="mt-2 flex justify-end text-[0.58rem] text-white/30">{customDirection.length}/{LOCATION_FIELD_LIMITS.customDirection}</div>
                <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={aiBusy || customDirection.length > LOCATION_FIELD_LIMITS.customDirection} onClick={generateDraft} className="admin-btn-primary">{aiBusy ? "Generating…" : customDirection.trim() ? "Generate with direction" : "Auto generate"}</button>{aiDraft ? <button type="button" onClick={applyAiDraft} className="admin-btn-secondary">Apply complete draft</button> : null}{aiDraft ? <button type="button" onClick={() => { setAiDraft(null); setAiMessage("Draft discarded. Existing content was not changed."); }} className="admin-btn-secondary">Discard draft</button> : null}</div>
                {aiMessage ? <p role="status" aria-live="polite" className="mt-4 text-sm leading-6 text-white/55">{aiMessage}</p> : null}
                {aiDraft ? <div className="mt-6 space-y-3">{AI_LOCATION_FIELDS.filter((field) => aiDraft[field]).map((field) => <article key={field} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-4"><h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{field.replace(/([A-Z])/g, " $1")}</h4><button type="button" onClick={() => applyAiField(field)} className="admin-btn-link">Apply field</button></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/65">{aiDraft[field]}</p></article>)}</div> : null}
              </div> : null}
            </section>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <Field label="City" value={draft.city} onChange={(city) => setDraft({ ...draft, city })} maxLength={100} />
              <Field label="State" value={draft.state} onChange={(state) => setDraft({ ...draft, state })} maxLength={100} />
              <Field label="County or market" value={draft.county} onChange={(county) => setDraft({ ...draft, county })} maxLength={140} />
              <Field label="URL slug" value={draft.slug} onChange={(slug) => setDraft({ ...draft, slug })} maxLength={120} help={`/locations/${draft.slug}`} />
              <div className="sm:col-span-2"><Field label="SEO title" value={draft.seoTitle} onChange={(seoTitle) => setDraft({ ...draft, seoTitle })} maxLength={160} /></div>
              <div className="sm:col-span-2"><Field label="SEO description" value={draft.seoDescription} onChange={(seoDescription) => setDraft({ ...draft, seoDescription })} maxLength={320} multiline /></div>
              <div className="sm:col-span-2"><Field label="Hero introduction" value={draft.heroLead} onChange={(heroLead) => setDraft({ ...draft, heroLead })} maxLength={320} multiline /></div>
              <div className="sm:col-span-2"><Field label="Opening story" value={draft.introduction} onChange={(introduction) => setDraft({ ...draft, introduction })} maxLength={1400} multiline /></div>
              <div className="sm:col-span-2"><Field label="Market headline" value={draft.marketTitle} onChange={(marketTitle) => setDraft({ ...draft, marketTitle })} maxLength={240} /></div>
              <div className="sm:col-span-2"><Field label="Market story" value={draft.marketCopy} onChange={(marketCopy) => setDraft({ ...draft, marketCopy })} maxLength={1400} multiline /></div>
              <div className="sm:col-span-2"><Field label="Closing CTA headline" value={draft.ctaHeadline || ""} onChange={(ctaHeadline) => setDraft({ ...draft, ctaHeadline })} maxLength={240} multiline help="Leave blank to use the location-aware default." /></div>
              <section className="space-y-5 rounded-xl border border-white/10 bg-black/20 p-5 sm:col-span-2" aria-labelledby="location-image-title">
                <div><p className="eyebrow text-[var(--helios-orange)]">Managed media</p><h3 id="location-image-title" className="mt-2 text-xl font-light text-white">Location feature image</h3><p className="mt-2 text-sm leading-6 text-white/35">Optional. The image appears beside the Market Story and is not saved until you save the page.</p></div>
                {draft.featureImageUrl ? <div className="relative aspect-[4/3] max-w-2xl overflow-hidden rounded-xl bg-black"><Image src={draft.featureImageUrl} alt={draft.featureImageAlt || ""} fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" style={{ objectPosition: `${draft.featureImageFocalX * 100}% ${draft.featureImageFocalY * 100}%` }} /></div> : null}
                <div className="flex flex-wrap gap-3"><label className={`admin-btn-secondary cursor-pointer ${uploadBusy ? "pointer-events-none opacity-50" : ""}`}>{uploadBusy ? "Uploading…" : draft.featureImageUrl ? "Replace image" : "Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploadBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFeatureImage(file); event.target.value = ""; }} /></label>{draft.featureImageUrl ? <button type="button" onClick={() => { if (window.confirm("Remove the saved location image when this page is saved?")) setDraft({ ...draft, featureImageStorageKey: null, featureImageUrl: null, featureImageAlt: null }); }} className="admin-btn-link-destructive">Remove image</button> : null}</div>
                {draft.featureImageUrl ? <><Field label="Feature image alt text" value={draft.featureImageAlt || ""} onChange={(featureImageAlt) => setDraft({ ...draft, featureImageAlt })} maxLength={240} help="Describe meaningful content, or leave empty when the image is decorative." /><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/40">Horizontal focal point<input type="range" min="0" max="1" step="0.01" value={draft.featureImageFocalX} onChange={(event) => setDraft({ ...draft, featureImageFocalX: Number(event.target.value) })} className="mt-3 w-full accent-[var(--helios-orange)]" /></label><label className="text-xs text-white/40">Vertical focal point<input type="range" min="0" max="1" step="0.01" value={draft.featureImageFocalY} onChange={(event) => setDraft({ ...draft, featureImageFocalY: Number(event.target.value) })} className="mt-3 w-full accent-[var(--helios-orange)]" /></label></div></> : null}
              </section>
              <div className="sm:col-span-2">
                <Field label="Local focus points" value={draft.localDetails.join("\n")} onChange={(value) => setDraft({ ...draft, localDetails: value.split("\n").slice(0, 8) })} maxLength={1900} multiline help="One item per line; up to eight" />
              </div>
              <div className="sm:col-span-2"><Field label="Service area" value={draft.serviceArea} onChange={(serviceArea) => setDraft({ ...draft, serviceArea })} maxLength={500} multiline /></div>
            </div>
            {error ? <p className="mt-6 rounded-xl border border-red-300/15 bg-red-300/[0.05] px-4 py-3 text-sm text-red-200/75">{error}</p> : null}
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={busy} onClick={() => { setEditing(null); setDraft(null); setAiDraft(null); }} className="admin-btn-secondary">Cancel</button>
              <button type="button" disabled={busy} onClick={savePage} className="admin-btn-primary">{busy ? "Saving…" : "Save draft"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
