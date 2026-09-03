"use client";

import Image from "next/image";
import { useId, useState } from "react";

import type { PhotoComparisonContent, PhotoComparisonPairValue } from "@/lib/photo-comparison";

const suggestedEditorialStyles = ["Aura", "Fuze", "Brut"] as const;

type PageValue = { active: boolean; content: PhotoComparisonContent; detailImageStorageKey: string | null; detailImageUrl: string; detailImageAlt: string; pairs: PhotoComparisonPairValue[] };

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "The request could not be completed.");
  return data;
}

export default function PhotoComparisonManager({ initialPage }: { initialPage: PageValue }) {
  const [page, setPage] = useState(initialPage);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const setContent = (key: keyof PhotoComparisonContent, value: string | string[]) => setPage((current) => ({ ...current, content: { ...current.content, [key]: value } }));
  const setPair = (index: number, patch: Partial<PhotoComparisonPairValue>) => setPage((current) => ({ ...current, pairs: current.pairs.map((pair, pairIndex) => pairIndex === index ? { ...pair, ...patch } : pair) }));

  async function upload(file: File, kind: "detail" | "standard" | "editorial", index?: number) {
    setBusy(true); setMessage("");
    try {
      const data = await jsonRequest("/api/admin/photo-comparison/presign", { method: "POST", body: JSON.stringify({ kind, fileType: file.type, fileSize: file.size }) });
      const uploaded = await fetch(data.upload.uploadUrl, { method: "PUT", headers: { "Content-Type": data.upload.contentType }, body: file });
      if (!uploaded.ok) throw new Error("The image could not be uploaded.");
      if (kind === "detail") setPage((current) => ({ ...current, detailImageStorageKey: data.upload.key, detailImageUrl: data.upload.publicUrl }));
      else if (index !== undefined) setPair(index, kind === "standard" ? { standardImageStorageKey: data.upload.key, standardImageUrl: data.upload.publicUrl } : { editorialImageStorageKey: data.upload.key, editorialImageUrl: data.upload.publicUrl });
      setMessage("Image uploaded. Save the page to publish it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The image could not be uploaded."); }
    finally { setBusy(false); }
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= page.pairs.length) return;
    setPage((current) => { const pairs = [...current.pairs]; [pairs[index], pairs[nextIndex]] = [pairs[nextIndex], pairs[index]]; return { ...current, pairs: pairs.map((pair, position) => ({ ...pair, position })) }; });
  }

  function addPair() {
    setPage((current) => ({ ...current, pairs: [...current.pairs, { id: `new-${crypto.randomUUID()}`, label: `Comparison ${current.pairs.length + 1}`, editorialStyle: null, alt: "Describe the room and property", caption: "Drag to compare the overall visual direction.", active: true, position: current.pairs.length, standardImageStorageKey: null, standardImageUrl: "/photo-finishes/standard-kitchen.jpg", editorialImageStorageKey: null, editorialImageUrl: "/photo-finishes/editorial-kitchen.jpg" }] }));
  }

  async function save() {
    setBusy(true); setMessage("");
    try { await jsonRequest("/api/admin/photo-comparison", { method: "PATCH", body: JSON.stringify(page) }); setMessage("Photo comparison saved and published."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The page could not be saved."); }
    finally { setBusy(false); }
  }

  const c = page.content;
  return <div className="space-y-7">
    {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/55">{message}</p>}
    <section className="rounded-2xl border border-white/[.08] bg-[#111] p-5 sm:p-7"><label className="flex items-start gap-3"><input type="checkbox" checked={page.active} onChange={(event) => setPage((current) => ({ ...current, active: event.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--helios-orange)]" /><span><span className="block text-sm text-white/80">Publish photo comparison page</span><span className="mt-1 block text-xs text-white/35">When disabled, the public URL returns a not-found page. Studio content is preserved.</span></span></label></section>

    <Panel eyebrow="Opening frame" title="Hero and comparison introduction"><div className="grid gap-4 lg:grid-cols-2"><Input label="Hero eyebrow" value={c.heroEyebrow} onChange={(v) => setContent("heroEyebrow", v)} /><Input label="Hero headline" value={c.heroHeading} onChange={(v) => setContent("heroHeading", v)} /><Input label="Italic headline" value={c.heroAccent} onChange={(v) => setContent("heroAccent", v)} /><Textarea label="Hero introduction" value={c.heroBody} onChange={(v) => setContent("heroBody", v)} /><Input label="Comparison eyebrow" value={c.comparisonEyebrow} onChange={(v) => setContent("comparisonEyebrow", v)} /><Input label="Comparison heading" value={c.comparisonHeading} onChange={(v) => setContent("comparisonHeading", v)} /><div className="lg:col-span-2"><Textarea label="Comparison instructions" value={c.comparisonBody} onChange={(v) => setContent("comparisonBody", v)} /></div></div></Panel>

    <Panel eyebrow="Before and after" title="Comparison image pairs" action={<button type="button" onClick={addPair} className="admin-btn-secondary">Add Pair</button>}><div className="space-y-5">{page.pairs.map((pair, index) => <article key={pair.id} className="rounded-xl border border-white/[.08] bg-black/20 p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-white/55"><input type="checkbox" checked={pair.active} onChange={(event) => setPair(index, { active: event.target.checked })} className="accent-[var(--helios-orange)]" /> Visible</label><div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="admin-btn-link">Move up</button><button type="button" disabled={index === page.pairs.length - 1} onClick={() => move(index, 1)} className="admin-btn-link">Move down</button><button type="button" disabled={page.pairs.length === 1} onClick={() => setPage((current) => ({ ...current, pairs: current.pairs.filter((_, i) => i !== index) }))} className="admin-btn-link text-red-300">Remove</button></div></div><div className="grid gap-4 lg:grid-cols-2"><ImageUpload label="Standard Finish" src={pair.standardImageUrl} alt={pair.alt} busy={busy} onFile={(file) => void upload(file, "standard", index)} /><ImageUpload label="Editorial Finish" src={pair.editorialImageUrl} alt={pair.alt} busy={busy} onFile={(file) => void upload(file, "editorial", index)} /></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Input label="Internal label" value={pair.label} onChange={(v) => setPair(index, { label: v })} /><EditorialStyleInput value={pair.editorialStyle} onChange={(v) => setPair(index, { editorialStyle: v })} /><Input label="Accessible image description" value={pair.alt} onChange={(v) => setPair(index, { alt: v })} /><div className="lg:col-span-2"><Textarea label="Caption" value={pair.caption} onChange={(v) => setPair(index, { caption: v })} /></div></div></article>)}</div></Panel>

    <Panel eyebrow="Positioning" title="Finish descriptions"><div className="grid gap-6 lg:grid-cols-2"><FinishFields prefix="Standard" title={c.standardTitle} positioning={c.standardPositioning} description={c.standardDescription} features={c.standardFeatures} onTitle={(v) => setContent("standardTitle", v)} onPositioning={(v) => setContent("standardPositioning", v)} onDescription={(v) => setContent("standardDescription", v)} onFeatures={(v) => setContent("standardFeatures", v)} /><FinishFields prefix="Editorial" title={c.editorialTitle} positioning={c.editorialPositioning} description={c.editorialDescription} features={c.editorialFeatures} onTitle={(v) => setContent("editorialTitle", v)} onPositioning={(v) => setContent("editorialPositioning", v)} onDescription={(v) => setContent("editorialDescription", v)} onFeatures={(v) => setContent("editorialFeatures", v)} /><div className="lg:col-span-2"><Input label="Editorial badge" value={c.editorialBadge} onChange={(v) => setContent("editorialBadge", v)} /></div></div></Panel>

    <Panel eyebrow="Guidance" title="Which finish fits?"><div className="grid gap-5 lg:grid-cols-[1fr_.85fr]"><div className="space-y-4"><Input label="Eyebrow" value={c.decisionEyebrow} onChange={(v) => setContent("decisionEyebrow", v)} /><Input label="Heading" value={c.decisionHeading} onChange={(v) => setContent("decisionHeading", v)} /><Textarea label="Guidance" value={c.decisionBody} onChange={(v) => setContent("decisionBody", v)} /></div><div><ImageUpload label="Supporting editorial image" src={page.detailImageUrl} alt={page.detailImageAlt} busy={busy} onFile={(file) => void upload(file, "detail")} /><div className="mt-4"><Input label="Image description" value={page.detailImageAlt} onChange={(value) => setPage((current) => ({ ...current, detailImageAlt: value }))} /></div></div></div></Panel>

    <Panel eyebrow="Conversion" title="Closing call to action"><div className="grid gap-4 lg:grid-cols-2"><Input label="Eyebrow" value={c.ctaEyebrow} onChange={(v) => setContent("ctaEyebrow", v)} /><Input label="Heading" value={c.ctaHeading} onChange={(v) => setContent("ctaHeading", v)} /><div className="lg:col-span-2"><Textarea label="Pricing and delivery copy" value={c.ctaBody} onChange={(v) => setContent("ctaBody", v)} /></div><Input label="Primary button label" value={c.primaryLabel} onChange={(v) => setContent("primaryLabel", v)} /><Input label="Primary destination" value={c.primaryDestination} onChange={(v) => setContent("primaryDestination", v)} /><Input label="Secondary button label" value={c.secondaryLabel} onChange={(v) => setContent("secondaryLabel", v)} /><Input label="Secondary destination" value={c.secondaryDestination} onChange={(v) => setContent("secondaryDestination", v)} /></div></Panel>

    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111]/95 p-4 shadow-2xl backdrop-blur"><a href="/photo-finishes" target="_blank" rel="noreferrer" className="admin-btn-secondary">Preview Public Page</a><button type="button" disabled={busy} onClick={() => void save()} className="admin-btn-primary">{busy ? "Saving…" : "Save & Publish"}</button></div>
  </div>;
}

function Panel({ eyebrow, title, action, children }: { eyebrow: string; title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/[.08] bg-[#111] p-5 sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">{eyebrow}</p><h2 className="mt-2 font-display text-3xl font-light text-white">{title}</h2></div>{action}</div><div className="mt-7">{children}</div></section>; }
function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-[.52rem] font-semibold uppercase tracking-[.14em] text-white/30">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>; }
function EditorialStyleInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) { const suggestionsId = useId(); return <label className="block text-[.52rem] font-semibold uppercase tracking-[.14em] text-white/30">Editorial style<input list={suggestionsId} value={value ?? ""} maxLength={60} placeholder="Aura, Fuze, Brut, or a new style" onChange={(event) => onChange(event.target.value || null)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-[var(--helios-orange)]" /><datalist id={suggestionsId}>{suggestedEditorialStyles.map((style) => <option key={style} value={style} />)}</datalist></label>; }
function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-[.52rem] font-semibold uppercase tracking-[.14em] text-white/30">{label}<textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>; }
function FinishFields({ prefix, title, positioning, description, features, onTitle, onPositioning, onDescription, onFeatures }: { prefix: string; title: string; positioning: string; description: string; features: string[]; onTitle: (v: string) => void; onPositioning: (v: string) => void; onDescription: (v: string) => void; onFeatures: (v: string[]) => void }) { return <div className="space-y-4 rounded-xl border border-white/[.07] p-4"><p className="text-sm text-white/60">{prefix} Finish</p><Input label="Title" value={title} onChange={onTitle} /><Input label="Positioning line" value={positioning} onChange={onPositioning} /><Textarea label="Description" value={description} onChange={onDescription} /><Textarea label="Features — one per line" value={features.join("\n")} onChange={(value) => onFeatures(value.split("\n").filter(Boolean))} /></div>; }
function ImageUpload({ label, src, alt, busy, onFile }: { label: string; src: string; alt: string; busy: boolean; onFile: (file: File) => void }) { return <div><p className="mb-2 text-[.52rem] font-semibold uppercase tracking-[.14em] text-white/30">{label}</p><div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/25"><Image src={src} alt={alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" /></div><label className="admin-btn-secondary mt-3 inline-flex cursor-pointer">Replace Image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} /></label></div>; }
