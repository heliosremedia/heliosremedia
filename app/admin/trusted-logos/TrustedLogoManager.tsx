"use client";

import { useEffect, useMemo, useState } from "react";

import TrustedLogoArtwork from "@/app/components/TrustedLogoArtwork";

export type AdminTrustedLogo = {
  id: string;
  organizationName: string;
  logoStorageKey: string | null;
  logoUrl: string | null;
  logoAlt: string | null;
  websiteUrl: string | null;
  monochrome: boolean;
  displayColor: string;
  displayOpacity: number;
  displayScale: number;
  displayOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

type Draft = { id: string | null; organizationName: string; logoStorageKey: string | null; logoUrl: string | null; logoAlt: string; websiteUrl: string; monochrome: boolean; displayColor: string; displayOpacity: number; displayScale: number; published: boolean };
const emptyDraft: Draft = { id: null, organizationName: "", logoStorageKey: null, logoUrl: null, logoAlt: "", websiteUrl: "", monochrome: true, displayColor: "#D8D3CC", displayOpacity: 0.68, displayScale: 1, published: false };

export default function TrustedLogoManager({ initialLogos }: { initialLogos: AdminTrustedLogo[] }) {
  const [logos, setLogos] = useState(initialLogos);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const publishedCount = useMemo(() => logos.filter((logo) => logo.published).length, [logos]);

  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  async function request(url: string, options: RequestInit) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok || data.success !== true) throw new Error(typeof data.error === "string" ? data.error : "The change could not be saved.");
    return data;
  }

  function openCreate() { setDraft({ ...emptyDraft }); setFile(null); setPreview(null); setError(null); setImageWarning(null); }
  function openEdit(logo: AdminTrustedLogo) { setDraft({ id: logo.id, organizationName: logo.organizationName, logoStorageKey: logo.logoStorageKey, logoUrl: logo.logoUrl, logoAlt: logo.logoAlt ?? "", websiteUrl: logo.websiteUrl ?? "", monochrome: logo.monochrome, displayColor: logo.displayColor, displayOpacity: logo.displayOpacity, displayScale: logo.displayScale, published: logo.published }); setFile(null); setPreview(logo.logoUrl); setError(null); setImageWarning(null); }
  async function chooseFile(next: File | null) {
    if (!next) return;
    setImageWarning(null);
    const warnings: string[] = [];
    if (next.size > 2 * 1024 * 1024) warnings.push("This file exceeds the recommended 2 MB size.");
    try {
      const bitmap = await createImageBitmap(next);
      if (bitmap.width < 600) warnings.push("A width of at least 600 pixels is recommended for crisp display.");
      const canvas = document.createElement("canvas");
      canvas.width = 2; canvas.height = 2;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(bitmap, 0, 0, 2, 2);
        const pixels = context.getImageData(0, 0, 2, 2).data;
        const opaqueCorners = [3, 7, 11, 15].every((index) => pixels[index] > 250);
        if (opaqueCorners) warnings.push("This image may have a solid background. Transparent artwork transforms more cleanly.");
      }
      bitmap.close();
    } catch { warnings.push("The browser could not inspect this image. Confirm that it has a transparent background."); }
    setImageWarning(warnings.join(" ") || null);
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next));
    setDraft((current) => current ? { ...current, logoAlt: current.logoAlt || current.organizationName } : current);
  }

  async function uploadLogo(image: File) {
    const data = await request("/api/admin/trusted-logos/presign", { method: "POST", body: JSON.stringify({ fileName: image.name, fileType: image.type, fileSize: image.size }) });
    const upload = data.upload as { key: string; uploadUrl: string; publicUrl: string; contentType: string };
    const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": upload.contentType }, body: image });
    if (!response.ok) throw new Error("The logo could not be uploaded.");
    return upload;
  }

  async function save() {
    if (!draft) return;
    setBusy(draft.id ?? "new"); setError(null);
    try {
      let logoStorageKey = draft.logoStorageKey;
      let logoUrl = draft.logoUrl;
      if (file) { const uploaded = await uploadLogo(file); logoStorageKey = uploaded.key; logoUrl = uploaded.publicUrl; }
      const data = await request("/api/admin/trusted-logos", { method: draft.id ? "PATCH" : "POST", body: JSON.stringify({ ...(draft.id ? { action: "update", logoId: draft.id } : {}), ...draft, logoStorageKey, logoUrl }) });
      const saved = data.logo as AdminTrustedLogo;
      setLogos((current) => current.some(({ id }) => id === saved.id) ? current.map((logo) => logo.id === saved.id ? saved : logo) : [...current, saved]);
      setDraft(null); setFile(null); setPreview(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save logo."); }
    finally { setBusy(null); }
  }

  async function toggle(logo: AdminTrustedLogo) {
    setBusy(logo.id); setError(null);
    try {
      const data = await request("/api/admin/trusted-logos", { method: "PATCH", body: JSON.stringify({ action: "set-published", logoId: logo.id, published: !logo.published }) });
      const saved = data.logo as AdminTrustedLogo;
      setLogos((current) => current.map((item) => item.id === logo.id ? saved : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update logo."); }
    finally { setBusy(null); }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= logos.length) return;
    const previous = logos;
    const reordered = [...logos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setLogos(reordered); setBusy("order"); setError(null);
    try { await request("/api/admin/trusted-logos", { method: "PATCH", body: JSON.stringify({ action: "reorder", logoIds: reordered.map(({ id }) => id) }) }); }
    catch (caught) { setLogos(previous); setError(caught instanceof Error ? caught.message : "Unable to save logo order."); }
    finally { setBusy(null); }
  }

  async function remove(logo: AdminTrustedLogo) {
    if (!window.confirm(`Permanently delete the ${logo.organizationName} logo?`)) return;
    setBusy(logo.id); setError(null);
    try { await request(`/api/admin/trusted-logos?logoId=${encodeURIComponent(logo.id)}`, { method: "DELETE" }); setLogos((current) => current.filter(({ id }) => id !== logo.id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete logo."); }
    finally { setBusy(null); }
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.17em] text-white/25">Logo library</p><p className="mt-2 text-3xl font-light text-white">{logos.length}</p></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.17em] text-white/25">Published</p><p className="mt-2 text-3xl font-light text-white">{publishedCount}</p></div></section>
      {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-200/80">{error}</div>}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7">
        <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow text-[var(--helios-orange)]">Partner presentation</p><h2 className="mt-2 text-2xl font-light text-white">Organization logos</h2><p className="mt-2 text-sm text-white/30">Published logos flow through the homepage rail in this order.</p></div><button type="button" onClick={openCreate} className="self-start rounded-full bg-[var(--helios-orange)] px-5 py-3 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black sm:self-auto">Add logo</button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {logos.map((logo, index) => <article key={logo.id} className={`overflow-hidden rounded-2xl border bg-white/[0.02] ${logo.published ? "border-white/[0.09]" : "border-white/[0.06] opacity-65"}`}>
            <div className="relative flex h-40 items-center justify-center bg-black/20 p-7">{logo.logoUrl ? <TrustedLogoArtwork src={logo.logoUrl} alt={logo.logoAlt || logo.organizationName} monochrome={logo.monochrome} color={logo.displayColor} opacity={logo.displayOpacity} scale={logo.displayScale} /> : <span className="text-sm text-white/20">No logo</span>}</div>
            <div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm text-white/75">{logo.organizationName}</h3><p className="mt-1 truncate text-xs text-white/25">{logo.websiteUrl || "No destination link"}</p></div><span className={`rounded-full border px-2 py-1 text-[0.47rem] uppercase tracking-[0.12em] ${logo.published ? "border-emerald-300/15 text-emerald-200/55" : "border-white/10 text-white/25"}`}>{logo.published ? "Published" : "Draft"}</span></div>
              <div className="mt-4 flex items-center gap-1 border-t border-white/[0.06] pt-3"><button type="button" aria-label={`Move ${logo.organizationName} up`} disabled={index === 0 || busy !== null} onClick={() => move(index, -1)} className="px-2 py-1 text-white/30 hover:text-white disabled:opacity-20">↑</button><button type="button" aria-label={`Move ${logo.organizationName} down`} disabled={index === logos.length - 1 || busy !== null} onClick={() => move(index, 1)} className="px-2 py-1 text-white/30 hover:text-white disabled:opacity-20">↓</button><button type="button" disabled={busy !== null} onClick={() => toggle(logo)} className="ml-auto px-2 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-white/30 hover:text-white">{logo.published ? "Unpublish" : "Publish"}</button><button type="button" onClick={() => openEdit(logo)} className="px-2 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-white/30 hover:text-white">Edit</button><button type="button" disabled={busy !== null} onClick={() => remove(logo)} className="px-2 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-red-200/35 hover:text-red-200">Delete</button></div>
            </div>
          </article>)}
          {logos.length === 0 && <div className="col-span-full py-24 text-center"><p className="font-display text-4xl font-light text-white/30">No trusted brands yet.</p><p className="mt-3 text-sm text-white/20">Add the first organization logo to begin.</p></div>}
        </div>
      </section>

      {draft && <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/85 p-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="logo-dialog-title"><div className="w-full max-w-3xl rounded-2xl border border-white/[0.1] bg-[#151515] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Trusted brand</p><h2 id="logo-dialog-title" className="mt-2 text-2xl font-light text-white">{draft.id ? "Edit organization" : "New organization"}</h2></div><button type="button" onClick={() => setDraft(null)} className="h-10 w-10 rounded-full border border-white/10 text-white/40">×</button></div>
        <div className="mt-7 grid gap-7 sm:grid-cols-[17rem_minmax(0,1fr)]"><div><div className="flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-black/25 p-8">{preview ? <TrustedLogoArtwork src={preview} alt="Logo treatment preview" monochrome={draft.monochrome} color={draft.displayColor} opacity={draft.displayOpacity} scale={draft.displayScale} /> : <span className="text-sm text-white/20">Logo preview</span>}</div><label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-white/10 text-[0.53rem] font-semibold uppercase tracking-[0.14em] text-white/40 hover:border-white/25 hover:text-white">Choose logo<input type="file" accept="image/png,image/webp,image/avif" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} /></label>
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-[0.52rem] font-semibold uppercase tracking-[0.15em] text-[var(--helios-orange)]">Recommended artwork</p><p className="mt-2 text-xs leading-5 text-white/32">Transparent PNG, WebP, or AVIF · approximately 1200 × 600 px · centered with comfortable padding · under 2 MB.</p></div>
          {imageWarning && <p role="status" className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100/60">{imageWarning}</p>}
          </div>
          <div className="space-y-5"><Field label="Organization name"><input required maxLength={160} value={draft.organizationName} onChange={(event) => setDraft({ ...draft, organizationName: event.target.value, logoAlt: draft.logoAlt || event.target.value })} className="field" /></Field><Field label="Accessible logo description"><input maxLength={240} value={draft.logoAlt} onChange={(event) => setDraft({ ...draft, logoAlt: event.target.value })} className="field" /></Field><Field label="Organization website"><input type="url" maxLength={1000} value={draft.websiteUrl} onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })} className="field" /></Field>
          <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-white/40">Color treatment</p><p className="mt-1 text-xs text-white/25">Helios monochrome is recommended.</p></div><button type="button" onClick={() => setDraft({ ...draft, monochrome: !draft.monochrome })} className={`rounded-full border px-4 py-2 text-[0.51rem] font-semibold uppercase tracking-[0.13em] ${draft.monochrome ? "border-[var(--helios-orange)]/30 text-[var(--helios-orange)]" : "border-white/10 text-white/35"}`}>{draft.monochrome ? "Monochrome" : "Original color"}</button></div>
            {draft.monochrome && <label className="mt-4 flex items-center justify-between gap-4 text-xs text-white/35">Display color<input type="color" value={draft.displayColor} onChange={(event) => setDraft({ ...draft, displayColor: event.target.value.toUpperCase() })} className="h-9 w-14 cursor-pointer rounded border-0 bg-transparent" /></label>}
            <label className="mt-4 block text-xs text-white/35"><span className="flex justify-between"><span>Scale</span><span>{Math.round(draft.displayScale * 100)}%</span></span><input type="range" min="0.5" max="1.5" step="0.01" value={draft.displayScale} onChange={(event) => setDraft({ ...draft, displayScale: Number(event.target.value) })} className="mt-2 w-full accent-[var(--helios-orange)]" /></label>
            <label className="mt-4 block text-xs text-white/35"><span className="flex justify-between"><span>Opacity</span><span>{Math.round(draft.displayOpacity * 100)}%</span></span><input type="range" min="0.2" max="1" step="0.01" value={draft.displayOpacity} onChange={(event) => setDraft({ ...draft, displayOpacity: Number(event.target.value) })} className="mt-2 w-full accent-[var(--helios-orange)]" /></label>
          </div>
          <label className="flex items-center gap-3 text-sm text-white/45"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]" />Published</label></div>
        </div>
        <div className="mt-8 flex justify-end gap-3 border-t border-white/[0.08] pt-6"><button type="button" onClick={() => setDraft(null)} className="rounded-full border border-white/10 px-5 py-3 text-[0.54rem] uppercase tracking-[0.14em] text-white/40">Cancel</button><button type="button" onClick={save} disabled={busy !== null || !draft.organizationName.trim() || (!draft.logoUrl && !file)} className="rounded-full bg-[var(--helios-orange)] px-6 py-3 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-40">{busy ? file ? "Uploading…" : "Saving…" : "Save logo"}</button></div>
      </div></div>}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">{label}<span className="[&_.field]:mt-2 [&_.field]:w-full [&_.field]:rounded-xl [&_.field]:border [&_.field]:border-white/10 [&_.field]:bg-black/25 [&_.field]:px-4 [&_.field]:py-3 [&_.field]:text-sm [&_.field]:normal-case [&_.field]:tracking-normal [&_.field]:text-white [&_.field]:outline-none focus-within:[&_.field]:border-[var(--helios-orange)]">{children}</span></label>;
}
