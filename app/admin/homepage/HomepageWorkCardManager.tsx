"use client";

import { isWorkCardMediaKey, canonicalWorkCardUrl } from "@/lib/work-card-media";
import { useState } from "react";
import Image from "next/image";
import { useCurationRecovery } from "./useCurationRecovery";
import { sameIds, sameMembers, record, normalized, mergeDraft } from "@/lib/homepage-curation-editor";

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

function uploadFile(file: File, url: string, contentType: string, progress: (value: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.upload.onprogress = (event) => event.lengthComputable && progress(Math.round((event.loaded / event.total) * 100));
    request.timeout = 120000;
    request.ontimeout = () => reject(new Error("Upload timed out."));
    request.onabort = () => reject(new Error("Upload cancelled."));
    signal.addEventListener("abort", () => request.abort(), { once: true });
    if (signal.aborted) { reject(new Error("Upload cancelled.")); return; }
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Cloudflare R2 rejected the upload."));
    request.onerror = () => reject(new Error("The upload connection was interrupted."));
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.send(file);
  });
}

export default function HomepageWorkCardManager({ initialCards, services, films, workspaceId, initialRevision }: { workspaceId: string; initialRevision: string; initialCards: WorkCard[]; services: ServiceOption[]; films: FilmOption[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [cardFeedback, setCardFeedback] = useState<Record<string, string>>({});
  const recovery = useCurationRecovery('work-cards', workspaceId, initialRevision, { cards: initialCards, selectedService: '', preparedUpload: null as Record<string, unknown> | null });
  const snapshot = recovery.draft, { cards, selectedService } = snapshot;
  const setCards = (update: WorkCard[] | ((rows: WorkCard[]) => WorkCard[])) => recovery.setDraft(current => ({ ...current, cards: typeof update === 'function' ? update(current.cards) : update }));
  const setSelectedService = (update: string | ((value: string) => string)) => recovery.setDraft(current => ({ ...current, selectedService: typeof update === 'function' ? update(current.selectedService) : update }));
  const availableServices = services.filter(service => !cards.some(card => card.serviceId === service.id));
  const locked = busy !== null || recovery.blocked;
  function replaceLocal(next: WorkCard) {
    if (recovery.edit(snapshot)) setCards(current => current.map(card => card.id === next.id ? next : card));
  }
  const editable = (card: WorkCard) => ({ cardId: card.id, serviceId: card.serviceId, titleOverride: card.titleOverride, destinationOverride: card.destinationOverride, active: card.active, imageStorageKey: card.imageStorageKey, imageUrl: card.imageUrl, imageAlt: card.imageAlt, mediaMode: card.mediaMode, featuredMediaId: card.featuredMediaId, videoStorageKey: card.videoStorageKey, videoUrl: card.videoUrl });
  type Token = NonNullable<ReturnType<typeof recovery.begin>>;
  async function write(token: Token, method: string, body: Record<string, unknown>, submitted?: WorkCard, preparedProof?: Record<string, unknown>) {
    const ids = cards.map(card => card.id);
    const data = await recovery.mutate(token, '/api/admin/homepage-work-cards' + (method === 'DELETE' ? `?cardId=${encodeURIComponent(submitted!.id)}` : ''), { method, body: method === 'DELETE' ? undefined : JSON.stringify(body) }, (result, order) => {
      if (method === 'DELETE') return result.deletedCardId === submitted?.id && sameMembers(order, ids.filter(id => id !== submitted?.id));
      if (body.action === 'reorder') return sameIds(order, body.cardIds as string[]) && Array.isArray(result.cardIds) && sameIds(result.cardIds as string[], order);
      const row = record(result.card), service = record(row?.service);
      if (!row || !service || service.id !== row.serviceId || !services.some(item => item.id === row.serviceId) || typeof row.id !== 'string' || typeof row.active !== 'boolean' || !Number.isInteger(row.displayOrder)) return false;
      if (['titleOverride','destinationOverride','imageStorageKey','imageUrl','imageAlt','featuredMediaId','videoStorageKey','videoUrl'].some(key => row[key] !== null && typeof row[key] !== 'string') || !['IMAGE','LIBRARY_VIDEO','UPLOADED_VIDEO'].includes(String(row.mediaMode)) || typeof service.name !== 'string' || typeof service.slug !== 'string' || typeof service.active !== 'boolean') return false;
      if (row.featuredMediaId !== null && record(row.featuredMedia)?.id !== row.featuredMediaId) return false;
      if (method === 'POST') return row.serviceId === body.serviceId && !ids.includes(row.id) && sameMembers(order, [...ids, row.id]);
      if (row.id !== submitted?.id || !sameMembers(order, ids)) return false;
      const media = record(result.media);
      if (!media || media.protocol !== 1 || media.intent !== 'attach' || media.cardId !== submitted.id) return false;
      for (const kind of ['image', 'video'] as const) {
        const proof = record(media[kind]), key = row[kind + 'StorageKey'], url = row[kind + 'Url'];
        if (preparedProof?.kind === kind && proof?.assetId !== preparedProof.assetId) return false;
        if (!proof || proof.workspaceId !== workspaceId || proof.cardId !== submitted.id || proof.serviceId !== row.serviceId || proof.kind !== kind || proof.key !== key || proof.mediaId !== key || proof.url !== url) return false;
        if (!key && !url) { if (proof.verification !== 'empty' || proof.assetId !== null) return false; }
        else if (key === null && typeof url === 'string') { if (proof.verification !== 'retained' || proof.assetId !== null || submitted[kind === 'image' ? 'imageStorageKey' : 'videoStorageKey'] !== null || submitted[kind === 'image' ? 'imageUrl' : 'videoUrl'] !== url || url.includes('/workspaces/')) return false; }
        else if (typeof key !== 'string' || typeof url !== 'string') return false;
        else if (key.startsWith('workspaces/')) {
          if (proof.verification !== 'registered' || typeof proof.assetId !== 'string' || !proof.assetId || !isWorkCardMediaKey(workspaceId, submitted.id, kind, key) || !canonicalWorkCardUrl(key, url)) return false;
        } else if (proof.verification !== 'retained' || key !== submitted[kind === 'image' ? 'imageStorageKey' : 'videoStorageKey'] || !key.startsWith(`site/homepage/work-cards/${submitted.id}/`)) return false;
      }
      return Object.entries(body).every(([key, value]) => {
        if (key === 'cardId') return true;
        if (key === 'featuredMediaId') return row[key] === (body.mediaMode === 'LIBRARY_VIDEO' ? value : null);
        if (key === 'destinationOverride') {
          let expected = normalized(value); if (!expected) expected = `/portfolio?service=${services.find(item => item.id === body.serviceId)!.slug}`;
          if (typeof expected === 'string' && !expected.startsWith('/')) { try { expected = new URL(expected).toString(); } catch { return false; } }
          return row[key] === expected;
        }
        return row[key] === normalized(value);
      });
    });
    if (!recovery.current(token)) return;
    if (data) {
      const order = data.acknowledgement.ids as string[];
      if (method === 'POST') { setCards(current => [...current, data.card as WorkCard]); setSelectedService(current => current === snapshot.selectedService ? '' : current); }
      else if (method === 'DELETE') setCards(current => current.filter(card => card.id !== submitted!.id));
      else if (body.action === 'reorder') setCards(current => [...current].sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id)));
      else setCards(current => current.map(card => card.id === submitted!.id ? mergeDraft(card, submitted!, data.card as WorkCard) : card));
      if (preparedProof) recovery.setDraft(current => ({ ...current, preparedUpload: null }));
      recovery.complete(token, false); setMessage('Curation change confirmed. Check the public page separately.');
      if (submitted) setCardFeedback(current => ({ ...current, [submitted.id]: 'Submitted change saved ✓' }));
    }
    setBusy(null); setProgress(0);
  }
  async function save(card: WorkCard) {
    const body = editable(card); const token = recovery.begin(snapshot, { method: 'PATCH', body }); if (!token) return;
    setBusy(card.id); setMessage(null); await write(token, 'PATCH', body, card);
  }
  async function add() {
    if (!selectedService) return; const body = { serviceId: selectedService }; const token = recovery.begin(snapshot, { method: 'POST', body }); if (!token) return;
    setBusy('add'); setMessage(null); await write(token, 'POST', body);
  }
  async function upload(card: WorkCard, kind: UploadKind, file: File) {
    const token = recovery.begin(snapshot, { upload: { cardId: card.id, kind, name: file.name } }); if (!token) return;
    setBusy(`${card.id}:${kind}`); setProgress(0); setMessage('Preparing upload…');
    try {
      const data = await recovery.transport(token, '/api/admin/homepage-work-cards/presign', { method: 'POST', headers: { 'x-curation-revision': token.revision, 'x-curation-request': token.requestId }, body: JSON.stringify({ cardId: card.id, kind, fileName: file.name, fileType: file.type, fileSize: file.size }) });
      if (!recovery.current(token)) return;
      const upload = data?.upload;
      const proof = record(data?.media), ack = record(data?.acknowledgement);
      if (!upload || typeof upload.key !== 'string' || !isWorkCardMediaKey(workspaceId, card.id, kind, upload.key) || typeof upload.publicUrl !== 'string' || !canonicalWorkCardUrl(upload.key, upload.publicUrl) || typeof upload.uploadUrl !== 'string' || !/^https:\/\//.test(upload.uploadUrl) || upload.contentType !== file.type
        || !proof || proof.protocol !== 1 || proof.intent !== 'prepare' || proof.workspaceId !== workspaceId || proof.cardId !== card.id || proof.serviceId !== card.serviceId || proof.kind !== kind || proof.mediaId !== upload.key || proof.key !== upload.key || proof.url !== upload.publicUrl || proof.verification !== 'registered' || typeof proof.assetId !== 'string' || !proof.assetId
        || !ack || ack.protocol !== 1 || ack.requestId !== token.requestId || ack.workspaceId !== workspaceId || ack.scope !== 'work-cards' || ack.previousRevision !== token.revision || ack.revision !== token.revision || !Array.isArray(ack.ids) || !sameIds(ack.ids as string[], cards.map(item => item.id))) throw new Error('Invalid upload response');
      recovery.setDraft(current => ({ ...current, preparedUpload: { ...proof, requestId: token.requestId, revision: token.revision, transfer: 'unconfirmed' } }));
      await uploadFile(file, upload.uploadUrl, upload.contentType, value => { if (recovery.current(token)) setProgress(value); }, token.controller.signal);
      if (!recovery.current(token)) return;
      recovery.setDraft(current => ({ ...current, preparedUpload: { ...proof, requestId: token.requestId, revision: token.revision, transfer: 'completed', attachment: 'unconfirmed' } }));
      // Keep the prepared reference even if the subsequent acknowledgement is lost.
      const prepared = kind === 'image' ? { imageStorageKey: upload.key as string, imageUrl: upload.publicUrl as string } : { videoStorageKey: upload.key as string, videoUrl: upload.publicUrl as string, mediaMode: 'UPLOADED_VIDEO' as const };
      const current = recovery.readDraft().cards.find(item => item.id === card.id); if (!current) throw new Error('Editor changed');
      // Upload does not silently save edits made while the transfer was running.
      const submitted = { ...card, ...prepared };
      setCards(rows => rows.map(row => row.id === card.id ? mergeDraft(row, card, submitted) : row));
      await write(token, 'PATCH', editable(submitted), submitted, proof);
    } catch { if (recovery.current(token)) { recovery.fail(token); setBusy(null); setProgress(0); } }
  }
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= cards.length) return;
    const next = [...cards]; [next[index], next[target]] = [next[target], next[index]];
    const body = { action: 'reorder', cardIds: next.map(card => card.id) }; const token = recovery.begin(snapshot, { method: 'PATCH', body }); if (!token) return;
    setCards(next); setBusy('reorder'); setMessage(null); await write(token, 'PATCH', body);
  }
  async function remove(card: WorkCard) {
    const token = recovery.begin(snapshot, { method: 'DELETE', card }); if (!token) return;
    setBusy(card.id); setMessage(null); await write(token, 'DELETE', {}, card);
  }

  return <section className="space-y-5 rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7">
    {recovery.panel}
    <div><p className="eyebrow text-[var(--helios-orange)]">Our Work service cards</p><div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-3 text-xs leading-5 text-white/40">{cards.length}/5 cards configured. Services already assigned are disabled in selectors to prevent accidental duplicates.</div><h2 className="mt-2 text-2xl font-light text-white">Five-card service collection</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/38">Save a service reassignment before uploading new media. These cards always appear beneath the optional Featured Project. Choose the service, image, destination, and whether a card displays a static image or a muted film.</p></div>
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-4 sm:flex-row">
      <select value={selectedService} onChange={(event) => { if (recovery.edit(snapshot)) setSelectedService(event.target.value); }} disabled={locked || cards.length >= 5} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white"><option value="">Select an active service</option>{availableServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
      <button type="button" onClick={() => void add()} disabled={!selectedService || locked || cards.length >= 5} className="admin-btn-primary">Add service card</button>
    </div>
    {message ? <p role="status" className="rounded-xl border border-white/[0.07] bg-black/20 p-4 text-sm text-white/50">{message}</p> : null}
    {busy?.includes(":") ? <div><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--helios-orange)]" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-white/30">Uploading {progress}%</p></div> : null}
    <div className="space-y-4">{cards.map((card, index) => {
      const updateLocal = (patch: Partial<WorkCard>) => replaceLocal({ ...card, ...patch });
      return <article key={card.id} className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 ${card.active ? "" : "opacity-60"}`}>
        <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="relative min-h-56 bg-white/[0.03]">{card.imageUrl ? <Image src={card.imageUrl} alt="" fill unoptimized sizes="256px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-white/25">Upload a card image</div>}<span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-[0.5rem] uppercase tracking-[0.13em] text-white/65">{index === 0 ? "Primary card" : `Card ${index + 1}`}</span></div>
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg text-white/85">{card.service.name}</h3><p className="mt-1 text-xs text-white/25">/portfolio?service={card.service.slug}</p><p className="mt-2 text-[0.62rem] uppercase tracking-[0.14em] text-white/35">Assigned service · {index + 1} of recommended 5</p></div><div className="flex gap-2"><button disabled={index === 0 || locked} onClick={() => void move(index, -1)} className="admin-btn-link">↑</button><button disabled={index === cards.length - 1 || locked} onClick={() => void move(index, 1)} className="admin-btn-link">↓</button></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Service assignment<select value={card.serviceId} onChange={(event) => { const service = services.find((item) => item.id === event.target.value); if (service) updateLocal({ serviceId: service.id, service: { ...service, active: true }, destinationOverride: `/portfolio?service=${service.slug}` }); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white">{services.map((service) => { const used = cards.some((item) => item.id !== card.id && item.serviceId === service.id); return <option key={service.id} value={service.id} disabled={used}>{service.name}{used ? " · already assigned" : ""}</option>; })}</select></label><label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Card title<input value={card.titleOverride || ""} onChange={(event) => updateLocal({ titleOverride: event.target.value })} placeholder={card.service.name} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white" /></label><label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Destination<input value={card.destinationOverride || ""} onChange={(event) => updateLocal({ destinationOverride: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white" /></label></div>
            <label className="block text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Image description<input value={card.imageAlt || ""} onChange={(event) => updateLocal({ imageAlt: event.target.value })} placeholder={`${card.service.name} by Helios Real Estate Media`} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white" /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Card media<select value={card.mediaMode} onChange={(event) => updateLocal({ mediaMode: event.target.value as WorkCard["mediaMode"] })} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white"><option value="IMAGE">Static image</option><option value="LIBRARY_VIDEO">Published film</option><option value="UPLOADED_VIDEO">Uploaded looping preview</option></select></label>{card.mediaMode === "LIBRARY_VIDEO" ? <label className="text-[0.52rem] uppercase tracking-[0.14em] text-white/35">Featured film<select value={card.featuredMediaId || ""} onChange={(event) => updateLocal({ featuredMediaId: event.target.value || null })} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white"><option value="">Choose a published film</option>{films.map((film) => <option key={film.id} value={film.id}>{film.label} · {film.provider}</option>)}</select></label> : <div className="flex items-end"><label className="admin-btn-secondary cursor-pointer">{card.mediaMode === "UPLOADED_VIDEO" && card.videoUrl ? "Replace preview" : "Upload looping preview"}<input disabled={locked} type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(card, "video", file); event.target.value = ""; }} /></label></div>}</div>
            <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-4"><label className="admin-btn-secondary cursor-pointer">{card.imageUrl ? "Replace image" : "Upload image"}<input disabled={locked} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(card, "image", file); event.target.value = ""; }} /></label><button type="button" onClick={() => updateLocal({ active: !card.active })} className="admin-btn-link">{card.active ? "Hide card" : "Show card"}</button><button type="button" disabled={locked} onClick={() => void remove(card)} className="admin-btn-link-destructive">Remove</button><span role="status" className="ml-auto text-xs text-white/45">{cardFeedback[card.id] || ""}</span><button type="button" disabled={locked} onClick={() => void save(card)} className="admin-btn-primary">{busy === card.id ? "Saving…" : "Save card"}</button></div>
          </div>
        </div>
      </article>;
    })}</div>
  </section>;
}
