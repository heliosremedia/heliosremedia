"use client";

import { useState } from "react";
import Image from "next/image";

export type WorkCard = {
  id: string;
  serviceId: string;
  titleOverride: string | null;
  destinationOverride: string | null;
  displayOrder: number;
  active: boolean;
  imageStorageKey: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  mediaMode: "IMAGE" | "LIBRARY_VIDEO" | "UPLOADED_VIDEO";
  featuredMediaId: string | null;
  videoStorageKey: string | null;
  videoUrl: string | null;
  service: { id: string; name: string; slug: string; active: boolean };
  featuredMedia: { id: string; caption: string | null; originalFilename: string | null; provider: string | null; externalId: string | null; externalUrl: string | null; sourceType: string; project: { title: string } } | null;
};

export type ServiceOption = { id: string; name: string; slug: string };
export type FilmOption = { id: string; label: string; provider: string };
type UploadKind = "image" | "video";

function uploadFile(file: File, url: string, contentType: string, progress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.upload.onprogress = (event) => event.lengthComputable && progress(Math.round((event.loaded / event.total) * 100));
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Cloudflare R2 rejected the upload."));
    request.onerror = () => reject(new Error("The upload connection was interrupted."));
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.send(file);
  });
}

export default function HomepageWorkCardManager({ initialCards, services, films }: { initialCards: WorkCard[]; services: ServiceOption[]; films: FilmOption[] }) {
  const [cards, setCards] = useState(initialCards);
  const [selectedService, setSelectedService] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const availableServices = services.filter((service) => !cards.some((card) => card.serviceId === service.id));

  async function request(url: string, options: RequestInit) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "The change could not be saved.");
    return data;
  }

  function replaceLocal(next: WorkCard) {
    setCards((current) => current.map((card) => card.id === next.id ? next : card));
  }

  async function save(card: WorkCard, success = "Homepage card saved.") {
    setBusy(card.id); setMessage(null);
    try {
      const data = await request("/api/admin/homepage-work-cards", {
        method: "PATCH",
        body: JSON.stringify({
          cardId: card.id,
          serviceId: card.serviceId,
          titleOverride: card.titleOverride,
          destinationOverride: card.destinationOverride,
          active: card.active,
          imageStorageKey: card.imageStorageKey,
          imageUrl: card.imageUrl,
          imageAlt: card.imageAlt,
          mediaMode: card.mediaMode,
          featuredMediaId: card.featuredMediaId,
          videoStorageKey: card.videoStorageKey,
          videoUrl: card.videoUrl,
        }),
      });
      replaceLocal(data.card); setMessage(success); return data.card as WorkCard;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save this card."); return null; }
    finally { setBusy(null); }
  }

  async function add() {
    if (!selectedService) return;
    setBusy("add"); setMessage(null);
    try {
      const data = await request("/api/admin/homepage-work-cards", { method: "POST", body: JSON.stringify({ serviceId: selectedService }) });
      setCards((current) => [...current, data.card]); setSelectedService(""); setMessage("Homepage card added. Upload its image when ready.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add this card."); }
    finally { setBusy(null); }
  }

  async function upload(card: WorkCard, kind: UploadKind, file: File) {
    setBusy(`${card.id}:${kind}`); setProgress(0); setMessage(`Preparing ${kind} upload…`);
    try {
      const data = await request("/api/admin/homepage-work-cards/presign", { method: "POST", body: JSON.stringify({ cardId: card.id, kind, fileName: file.name, fileType: file.type, fileSize: file.size }) });
      await uploadFile(file, data.upload.uploadUrl, data.upload.contentType, setProgress);
      const next = kind === "image"
        ? { ...card, imageStorageKey: data.upload.key, imageUrl: data.upload.publicUrl }
        : { ...card, videoStorageKey: data.upload.key, videoUrl: data.upload.publicUrl, mediaMode: "UPLOADED_VIDEO" as const };
      await save(next, kind === "image" ? "Card image uploaded and published." : "Looping preview uploaded and published.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The upload could not be completed."); }
    finally { setBusy(null); setProgress(0); }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;
    const previous = cards; const next = [...cards]; [next[index], next[target]] = [next[target], next[index]];
    setCards(next); setBusy("reorder");
    try { await request("/api/admin/homepage-work-cards", { method: "PATCH", body: JSON.stringify({ action: "reorder", cardIds: next.map(({ id }) => id) }) }); setMessage("Card order saved."); }
    catch (error) { setCards(previous); setMessage(error instanceof Error ? error.message : "Unable to reorder cards."); }
    finally { setBusy(null); }
  }

  async function remove(card: WorkCard) {
    setBusy(card.id);
    try { await request(`/api/admin/homepage-work-cards?cardId=${card.id}`, { method: "DELETE" }); setCards((current) => current.filter(({ id }) => id !== card.id)); setMessage("Homepage card removed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to remove this card."); }
    finally { setBusy(null); }
  }

  return <section className="space-y-5 rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7">
    <div><p className="eyebrow text-[var(--helios-orange)]">Our Work service cards</p><div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-3 text-xs leading-5 text-white/40">{cards.length}/5 cards configured. Services already assigned are disabled in selectors to prevent accidental duplicates.</div><h2 className="mt-2 text-2xl font-light text-white">Five-card service collection</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/38">These cards always appear beneath the optional Featured Project. Choose the service, image, destination, and whether a card displays a static image or a muted film.</p></div>
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-4 sm:flex-row">
      <select value={selectedService} onChange={(event) => setSelectedService(event.target.value)} disabled={cards.length >= 5} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white"><option value="">Select an active service</option>{availableServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
      <button type="button" onClick={() => void add()} disabled={!selectedService || busy !== null || cards.length >= 5} className="admin-btn-primary">Add service card</button>
    </div>
    {message ? <p role="status" className="rounded-xl border border-white/[0.07] bg-black/20 p-4 text-sm text-white/50">{message}</p> : null}
    {busy?.includes(":") ? <div><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--helios-orange)]" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-white/30">Uploading {progress}%</p></div> : null}
    <div className="space-y-4">{cards.map((card, index) => {
      const updateLocal = (patch: Partial<WorkCard>) => replaceLocal({ ...card, ...patch });
      return <article key={card.id} className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 ${card.active ? "" : "opacity-60"}`}>
        <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="relative min-h-56 bg-white/[0.03]">{card.imageUrl ? <Image src={card.imageUrl} alt="" fill unoptimized sizes="256px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-white/25">Upload a card image</div>}<span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-[0.5rem] uppercase tracking-[0.13em] text-white/65">{index === 0 ? "Primary card" : `Card ${index + 1}`}</span></div>
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg text-white/85">{card.service.name}</h3><p className="mt-1 text-xs text-white/25">/portfolio?service={card.service.slug}</p><p className="mt-2 text-[0.62rem] uppercase tracking-[0.14em] text-white/35">Assigned service · {index + 1} of recommended 5</p></div><div className="flex gap-2"><button disabled={index === 0 || busy !== null} onClick={() => void move(index, -1)} className="admin-btn-link">↑</button><button disabled={index === cards.length - 1 || busy !== null} onClick={() => void move(index, 1)} className="admin-btn-link">↓</button></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Service assignment<select value={card.serviceId} onChange={(event) => { const service = services.find((item) => item.id === event.target.value); if (service) updateLocal({ serviceId: service.id, service: { ...service, active: true }, destinationOverride: `/portfolio?service=${service.slug}` }); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white">{services.map((service) => { const used = cards.some((item) => item.id !== card.id && item.serviceId === service.id); return <option key={service.id} value={service.id} disabled={used}>{service.name}{used ? " · already assigned" : ""}</option>; })}</select></label><label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Card title<input value={card.titleOverride || ""} onChange={(event) => updateLocal({ titleOverride: event.target.value })} placeholder={card.service.name} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white" /></label><label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Destination<input value={card.destinationOverride || ""} onChange={(event) => updateLocal({ destinationOverride: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white" /></label></div>
            <label className="block text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Image description<input value={card.imageAlt || ""} onChange={(event) => updateLocal({ imageAlt: event.target.value })} placeholder={`${card.service.name} by Helios Real Estate Media`} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white" /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Card media<select value={card.mediaMode} onChange={(event) => updateLocal({ mediaMode: event.target.value as WorkCard["mediaMode"] })} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white"><option value="IMAGE">Static image</option><option value="LIBRARY_VIDEO">Published film</option><option value="UPLOADED_VIDEO">Uploaded looping preview</option></select></label>{card.mediaMode === "LIBRARY_VIDEO" ? <label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Featured film<select value={card.featuredMediaId || ""} onChange={(event) => updateLocal({ featuredMediaId: event.target.value || null })} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white"><option value="">Choose a published film</option>{films.map((film) => <option key={film.id} value={film.id}>{film.label} · {film.provider}</option>)}</select></label> : <div className="flex items-end"><label className="admin-btn-secondary cursor-pointer">{card.mediaMode === "UPLOADED_VIDEO" && card.videoUrl ? "Replace preview" : "Upload looping preview"}<input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(card, "video", file); event.target.value = ""; }} /></label></div>}</div>
            <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-4"><label className="admin-btn-secondary cursor-pointer">{card.imageUrl ? "Replace image" : "Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(card, "image", file); event.target.value = ""; }} /></label><button type="button" onClick={() => updateLocal({ active: !card.active })} className="admin-btn-link">{card.active ? "Hide card" : "Show card"}</button><button type="button" onClick={() => void remove(card)} className="admin-btn-link-destructive">Remove</button><button type="button" disabled={busy !== null} onClick={() => void save(card)} className="ml-auto admin-btn-primary">{busy === card.id ? "Saving…" : "Save card"}</button></div>
          </div>
        </div>
      </article>;
    })}</div>
  </section>;
}
