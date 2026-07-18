"use client";

import { useEffect, useMemo, useState } from "react";

export type AdminTestimonial = {
  id: string;
  agentName: string;
  jobTitle: string | null;
  brokerage: string | null;
  testimonial: string;
  photoStorageKey: string | null;
  photoUrl: string | null;
  photoAlt: string | null;
  sourceUrl: string | null;
  focalX: number;
  focalY: number;
  rating: number;
  displayOrder: number;
  published: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  id: string | null;
  agentName: string;
  jobTitle: string;
  brokerage: string;
  testimonial: string;
  photoStorageKey: string | null;
  photoUrl: string | null;
  photoAlt: string;
  sourceUrl: string;
  focalX: number;
  focalY: number;
  rating: number;
  published: boolean;
  featured: boolean;
};

const emptyDraft: Draft = {
  id: null, agentName: "", jobTitle: "", brokerage: "", testimonial: "",
  photoStorageKey: null, photoUrl: null, photoAlt: "", sourceUrl: "",
  focalX: 0.5, focalY: 0.2, rating: 5, published: false, featured: false,
};

export default function TestimonialManager({ initialTestimonials }: { initialTestimonials: AdminTestimonial[] }) {
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const publishedCount = useMemo(() => testimonials.filter((item) => item.published).length, [testimonials]);
  const featuredCount = useMemo(() => testimonials.filter((item) => item.featured).length, [testimonials]);

  useEffect(() => () => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function openCreate() { setDraft({ ...emptyDraft }); setPhotoFile(null); setPreviewUrl(null); setError(null); }
  function openEdit(item: AdminTestimonial) {
    setDraft({
      id: item.id, agentName: item.agentName, jobTitle: item.jobTitle ?? "", brokerage: item.brokerage ?? "",
      testimonial: item.testimonial, photoStorageKey: item.photoStorageKey, photoUrl: item.photoUrl,
      photoAlt: item.photoAlt ?? "", sourceUrl: item.sourceUrl ?? "", focalX: item.focalX,
      focalY: item.focalY, rating: item.rating, published: item.published, featured: item.featured,
    });
    setPhotoFile(null); setPreviewUrl(item.photoUrl); setError(null);
  }

  function choosePhoto(file: File | null) {
    if (!file) return;
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPhotoFile(file); setPreviewUrl(URL.createObjectURL(file)); setDraft((current) => current ? { ...current, photoAlt: current.photoAlt || current.agentName } : current);
  }

  async function jsonRequest(url: string, options: RequestInit) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok || data.success !== true) throw new Error(typeof data.error === "string" ? data.error : "The change could not be saved.");
    return data;
  }

  async function uploadPhoto(file: File) {
    const data = await jsonRequest("/api/admin/testimonials/presign", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
    });
    const upload = data.upload as { key: string; uploadUrl: string; publicUrl: string; contentType: string };
    const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": upload.contentType }, body: file });
    if (!response.ok) throw new Error("The agent photo could not be uploaded.");
    return upload;
  }

  async function save() {
    if (!draft) return;
    setBusy(draft.id ?? "new"); setError(null);
    try {
      let photoStorageKey = draft.photoStorageKey;
      let photoUrl = draft.photoUrl;
      if (photoFile) {
        const uploaded = await uploadPhoto(photoFile);
        photoStorageKey = uploaded.key;
        photoUrl = uploaded.publicUrl;
      }
      const data = await jsonRequest("/api/admin/testimonials", {
        method: draft.id ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(draft.id ? { action: "update", testimonialId: draft.id } : {}),
          ...draft, photoStorageKey, photoUrl,
        }),
      });
      const saved = data.testimonial as AdminTestimonial;
      setTestimonials((current) => current.some(({ id }) => id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setDraft(null); setPhotoFile(null); setPreviewUrl(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save testimonial."); }
    finally { setBusy(null); }
  }

  async function setStatus(item: AdminTestimonial, field: "published" | "featured") {
    setBusy(item.id); setError(null);
    try {
      const data = await jsonRequest("/api/admin/testimonials", { method: "PATCH", body: JSON.stringify({ action: "set-status", testimonialId: item.id, [field]: !item[field] }) });
      const saved = data.testimonial as AdminTestimonial;
      setTestimonials((current) => current.map((entry) => entry.id === item.id ? saved : entry));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update testimonial."); }
    finally { setBusy(null); }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= testimonials.length) return;
    const previous = testimonials;
    const reordered = [...testimonials];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setTestimonials(reordered); setBusy("order"); setError(null);
    try { await jsonRequest("/api/admin/testimonials", { method: "PATCH", body: JSON.stringify({ action: "reorder", testimonialIds: reordered.map(({ id }) => id) }) }); }
    catch (caught) { setTestimonials(previous); setError(caught instanceof Error ? caught.message : "Unable to save testimonial order."); }
    finally { setBusy(null); }
  }

  async function remove(item: AdminTestimonial) {
    if (!window.confirm(`Permanently delete the testimonial from ${item.agentName}?`)) return;
    setBusy(item.id); setError(null);
    try {
      await jsonRequest(`/api/admin/testimonials?testimonialId=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setTestimonials((current) => current.filter(({ id }) => id !== item.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete testimonial."); }
    finally { setBusy(null); }
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {[{ label: "Testimonials", value: testimonials.length }, { label: "Published", value: publishedCount }, { label: "Featured", value: featuredCount }].map((stat) => <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.17em] text-white/25">{stat.label}</p><p className="mt-2 text-3xl font-light text-white">{stat.value}</p></div>)}
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-200/80">{error}</div>}

      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7">
        <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow text-[var(--helios-orange)]">Social proof library</p><h2 className="mt-2 text-2xl font-light text-white">Agent testimonials</h2><p className="mt-2 text-sm text-white/30">Published, featured records appear on the homepage in this order.</p></div>
          <button type="button" onClick={openCreate} className="self-start rounded-full bg-[var(--helios-orange)] px-5 py-3 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black sm:self-auto">Add testimonial</button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {testimonials.map((item, index) => (
            <article key={item.id} className={`grid overflow-hidden rounded-2xl border bg-white/[0.02] sm:grid-cols-[9rem_minmax(0,1fr)] ${item.published ? "border-white/[0.09]" : "border-white/[0.06] opacity-70"}`}>
              <div className="relative min-h-44 bg-white/[0.03] sm:min-h-full">
                {item.photoUrl ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.photoUrl} alt={item.photoAlt || item.agentName} className="absolute inset-0 h-full w-full object-cover grayscale" style={{ objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%` }} />
                </> : <div className="flex h-full min-h-44 items-center justify-center text-4xl font-light text-white/15">{item.agentName.charAt(0)}</div>}
              </div>
              <div className="flex min-w-0 flex-col p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base text-white/80">{item.agentName}</h3><p className="mt-1 text-xs text-white/30">{[item.jobTitle, item.brokerage].filter(Boolean).join(" · ") || "No attribution details"}</p></div><div className="flex gap-1">{item.featured && <span className="rounded-full border border-[var(--helios-orange)]/20 px-2 py-1 text-[0.47rem] uppercase tracking-[0.12em] text-[var(--helios-orange)]">Featured</span>}<span className={`rounded-full border px-2 py-1 text-[0.47rem] uppercase tracking-[0.12em] ${item.published ? "border-emerald-300/15 text-emerald-200/55" : "border-white/10 text-white/25"}`}>{item.published ? "Published" : "Draft"}</span></div></div>
                <blockquote className="mt-4 line-clamp-4 font-display text-lg leading-6 text-white/55">“{item.testimonial}”</blockquote>
                <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-4">
                  <button type="button" aria-label={`Move ${item.agentName} up`} disabled={index === 0 || busy !== null} onClick={() => move(index, -1)} className="px-2 py-1 text-white/30 hover:text-white disabled:opacity-20">↑</button>
                  <button type="button" aria-label={`Move ${item.agentName} down`} disabled={index === testimonials.length - 1 || busy !== null} onClick={() => move(index, 1)} className="px-2 py-1 text-white/30 hover:text-white disabled:opacity-20">↓</button>
                  <button type="button" disabled={busy !== null} onClick={() => setStatus(item, "featured")} className="ml-auto px-2 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-white/30 hover:text-white">{item.featured ? "Unfeature" : "Feature"}</button>
                  <button type="button" disabled={busy !== null} onClick={() => setStatus(item, "published")} className="px-2 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-white/30 hover:text-white">{item.published ? "Unpublish" : "Publish"}</button>
                  <button type="button" onClick={() => openEdit(item)} className="px-2 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-white/30 hover:text-white">Edit</button>
                  <button type="button" disabled={busy !== null} onClick={() => remove(item)} className="px-2 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-red-200/35 hover:text-red-200">Delete</button>
                </div>
              </div>
            </article>
          ))}
          {testimonials.length === 0 && <div className="col-span-full py-24 text-center"><p className="font-display text-4xl font-light text-white/30">No testimonials yet.</p><p className="mt-3 text-sm text-white/20">Add the first agent story to begin.</p></div>}
        </div>
      </section>

      {draft && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/85 p-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="testimonial-dialog-title">
          <div className="mx-auto my-5 w-full max-w-5xl rounded-2xl border border-white/[0.1] bg-[#151515] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Client story</p><h2 id="testimonial-dialog-title" className="mt-2 text-2xl font-light text-white">{draft.id ? "Edit testimonial" : "New testimonial"}</h2></div><button type="button" onClick={() => setDraft(null)} className="h-10 w-10 rounded-full border border-white/10 text-white/40">×</button></div>
            <div className="mt-7 grid gap-7 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <div>
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                  {previewUrl ? <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Agent photo preview" className="absolute inset-0 h-full w-full object-cover grayscale" style={{ objectPosition: `${draft.focalX * 100}% ${draft.focalY * 100}%` }} />
                  </> : <div className="flex h-full items-center justify-center text-sm text-white/20">Agent photo</div>}
                </div>
                <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-white/10 text-[0.53rem] font-semibold uppercase tracking-[0.14em] text-white/40 hover:border-white/25 hover:text-white">Choose photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)} /></label>
                {previewUrl && <button type="button" onClick={() => { setPhotoFile(null); setPreviewUrl(null); setDraft((current) => current ? { ...current, photoStorageKey: null, photoUrl: null } : current); }} className="mt-2 w-full text-center text-[0.5rem] uppercase tracking-[0.13em] text-red-200/35 hover:text-red-200">Remove photo</button>}
                <label className="mt-5 block text-[0.52rem] uppercase tracking-[0.14em] text-white/30">Horizontal focus<input type="range" min="0" max="1" step="0.01" value={draft.focalX} onChange={(event) => setDraft({ ...draft, focalX: Number(event.target.value) })} className="mt-2 w-full accent-[var(--helios-orange)]" /></label>
                <label className="mt-3 block text-[0.52rem] uppercase tracking-[0.14em] text-white/30">Vertical focus<input type="range" min="0" max="1" step="0.01" value={draft.focalY} onChange={(event) => setDraft({ ...draft, focalY: Number(event.target.value) })} className="mt-2 w-full accent-[var(--helios-orange)]" /></label>
              </div>
              <div className="grid content-start gap-5 sm:grid-cols-2">
                <Field label="Agent name"><input required maxLength={120} value={draft.agentName} onChange={(event) => setDraft({ ...draft, agentName: event.target.value, photoAlt: draft.photoAlt || event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></Field>
                <Field label="Brokerage"><input maxLength={160} value={draft.brokerage} onChange={(event) => setDraft({ ...draft, brokerage: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></Field>
                <Field label="Job title"><input maxLength={120} value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></Field>
                <Field label="Photo alt text"><input maxLength={240} value={draft.photoAlt} onChange={(event) => setDraft({ ...draft, photoAlt: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></Field>
                <div className="sm:col-span-2"><Field label="Testimonial"><textarea required maxLength={2000} rows={7} value={draft.testimonial} onChange={(event) => setDraft({ ...draft, testimonial: event.target.value })} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case leading-7 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></Field><p className="mt-1 text-right text-[0.5rem] text-white/20">{draft.testimonial.length} / 2,000</p></div>
                <Field label="Review source URL"><input type="url" maxLength={1000} value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></Field>
                <Field label="Rating"><select value={draft.rating} onChange={(event) => setDraft({ ...draft, rating: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} {rating === 1 ? "star" : "stars"}</option>)}</select></Field>
                <label className="flex items-center gap-3 text-sm text-white/45"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]" />Published</label>
                <label className="flex items-center gap-3 text-sm text-white/45"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]" />Featured</label>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3 border-t border-white/[0.08] pt-6"><button type="button" onClick={() => setDraft(null)} className="rounded-full border border-white/10 px-5 py-3 text-[0.54rem] uppercase tracking-[0.14em] text-white/40">Cancel</button><button type="button" onClick={save} disabled={busy !== null || !draft.agentName.trim() || !draft.testimonial.trim()} className="rounded-full bg-[var(--helios-orange)] px-6 py-3 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-40">{busy ? photoFile ? "Uploading…" : "Saving…" : "Save testimonial"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">{label}{children}</label>;
}
