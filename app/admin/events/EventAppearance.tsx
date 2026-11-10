"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { EVENT_THEMES, getEventTheme, type EventTemplateKey } from "@/lib/events/themes";
import EventMotif from "@/app/events/EventMotif";
import EventImageLibrary from "./EventImageLibrary";
import { eventImageUploadError, type EventAppearanceFields } from "./ui-helpers";
import { uploadEventImage } from "./image-upload";

const button = "rounded-xl border border-white/15 px-3 py-2.5 text-sm text-white/80 transition hover:border-white/40 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] disabled:cursor-not-allowed disabled:opacity-40";

export default function EventAppearance({ value, title, disabled, onTemplateChange, onImageChange, onAltChange, onUploadingChange, onPreview }: {
  value: EventAppearanceFields;
  title: string;
  disabled: boolean;
  onTemplateChange: (key: EventTemplateKey) => void;
  onImageChange: (image: { url: string; altText?: string | null } | null) => void;
  onAltChange: (alt: string) => void;
  onUploadingChange: (uploading: boolean) => void;
  onPreview: () => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController | null>(null);
  const theme = getEventTheme(value.templateKey);

  useEffect(() => () => { uploadController.current?.abort(); }, []);

  async function upload(file: File) {
    const validationError = eventImageUploadError(file);
    if (validationError) { setError(validationError); if (fileInput.current) fileInput.current.value = ""; return; }
    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    setError(""); setUploading(true); onUploadingChange(true);
    try {
      const image = await uploadEventImage(file, controller.signal);
      if (!controller.signal.aborted) onImageChange(image);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The image could not be uploaded."); }
    finally {
      if (!controller.signal.aborted) {
        setUploading(false); onUploadingChange(false); uploadController.current = null;
        if (fileInput.current) fileInput.current.value = "";
      }
    }
  }

  function cancelUpload() {
    uploadController.current?.abort(); uploadController.current = null;
    setUploading(false); onUploadingChange(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return <fieldset className="border-t border-white/10 pt-6" disabled={disabled}>
    <legend className="pr-3 text-xs uppercase tracking-widest text-[var(--helios-orange)]">02 / Set the mood</legend>
    <div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-light text-white">A little more occasion.</h3><p className="mt-2 max-w-xl text-sm leading-6 text-white/50">Choose a holiday look or keep it classic. Your invitation, reminders, and RSVP page will share the same style.</p></div><button type="button" className={`${button} border-orange-300/40 text-orange-100`} disabled={uploading} onClick={onPreview}>Preview invitation</button></div>
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {EVENT_THEMES.map(option => <label key={option.key} className={`relative cursor-pointer overflow-hidden rounded-xl border transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--helios-orange)] ${value.templateKey === option.key ? "border-white/65 ring-1 ring-white/20" : "border-white/10 hover:border-white/35"}`}>
        <input className="sr-only" type="radio" name="event-template" value={option.key} checked={value.templateKey === option.key} onChange={() => onTemplateChange(option.key)} />
        <span className="relative flex h-28 items-center justify-between overflow-hidden px-4" style={{ background: option.surface, color: option.accent, borderBottom: `2px solid ${option.accent}` }}>
          <span className="text-[9px] uppercase leading-5 tracking-[0.2em]">Helios<br /><span className="text-[8px] opacity-60">You’re invited</span></span><EventMotif templateKey={option.key} className="h-20 w-24 shrink-0" />
          {value.templateKey === option.key && <span aria-hidden="true" className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: option.accent, color: option.buttonText }}>✓</span>}
        </span>
        <span className="block bg-white/[0.02] px-3 py-3"><span className="block text-sm text-white/90">{option.label}</span><span className="mt-1 block text-[11px] leading-5 text-white/45">{option.description}</span></span>
      </label>)}
    </div>
    <div className="mt-6 rounded-xl border border-white/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-sm text-white/85">Cover image <span className="text-white/40">· optional</span></h4><p className="mt-1 text-xs leading-5 text-white/45">Add a photo, holiday artwork, or a flyer. Keep event details in the text above so every guest can read them.</p></div></div>
      <div className="mt-4 overflow-hidden rounded-xl border" style={{ background: theme.surface, borderColor: theme.border }}>
        {value.imageUrl ? <div className="relative aspect-[16/7] bg-black/20"><Image unoptimized fill src={value.imageUrl} alt={value.imageAlt || title || "Selected invitation cover"} referrerPolicy="no-referrer" sizes="(min-width: 1280px) 800px, 90vw" className="object-contain" /></div> : <div className="flex items-center justify-between gap-4 px-5 py-4" style={{ color: theme.accent }}><div><p className="text-[9px] uppercase tracking-[0.22em]">Helios · You’re invited</p><p className="mt-3 font-[family-name:var(--font-cormorant)] text-2xl leading-tight" style={{ color: theme.text }}>{title || "Good company. A special occasion."}</p><p className="mt-2 text-[11px]" style={{ color: theme.muted }}>Beautiful with or without an image.</p></div><EventMotif templateKey={value.templateKey} className="h-20 w-24 shrink-0" /></div>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={button} disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? "Uploading image…" : value.imageUrl ? "Upload replacement" : "Upload image"}</button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-label="Upload invitation image" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        <button type="button" className={button} disabled={uploading} onClick={() => { setError(""); setLibraryOpen(true); }}>Choose from library</button>
        {uploading && <button type="button" className={button} onClick={cancelUpload}>Cancel upload</button>}
        {value.imageUrl && <button type="button" className={button} disabled={uploading} onClick={() => { onImageChange(null); setError(""); }}>Remove image</button>}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/40">JPG or PNG, up to 10 MB. A landscape image works best. Uploading doesn’t send invitations.</p>
      {uploading && <p role="status" className="mt-3 text-xs text-orange-200">Uploading your image. Wait for it to finish before saving the draft.</p>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200/20 bg-red-200/5 p-3 text-sm text-red-100">{error}</p>}
      {value.imageUrl && <label className="mt-4 block text-xs text-white/60">Image description for accessibility<input className="mt-2 w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]" maxLength={300} value={value.imageAlt} onChange={event => onAltChange(event.target.value)} placeholder="Describe what’s in the image" /><span className="mt-2 block text-[11px] text-white/40">Shown if an email blocks images and read by screen readers.</span></label>}
    </div>
    <p className="mt-4 text-xs leading-5 text-white/45">Preview your invitation with any seasonal style before saving. Your current details, image, and email wording are included.</p>
    {libraryOpen && <EventImageLibrary onClose={() => setLibraryOpen(false)} onChoose={image => { onImageChange(image); setLibraryOpen(false); }} />}
  </fieldset>;
}
