"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { NewsletterBlock, NewsletterGalleryImage } from "../types";
import ImageLibraryDialog from "./ImageLibraryDialog";
import { buildNewsletterImageDirection } from "@/lib/newsletters/image-direction";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-[var(--helios-orange)]";

export default function ImageSourcePanel({ block, onPatch }: {
  block: NewsletterBlock;
  onPatch: (values: Partial<NewsletterBlock>) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"gallery" | "generate">("gallery");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blockDirection = buildNewsletterImageDirection(block);
  const candidates = block.imageCandidates ?? [];
  const mode = block.imageSelection?.mode ?? (block.imageUrl ? "CUSTOM" : "AUTO");
  const choose = (candidate: NonNullable<NewsletterBlock["imageCandidates"]>[number]) => onPatch({
    imageUrl: candidate.url,
    altText: candidate.altText || block.altText || "",
    imageLink: candidate.destinationUrl || block.imageLink || "",
    imageIsVideo: candidate.isVideo,
    imageSelection: { mode: "SOURCE", candidateId: candidate.id, sourceLabel: candidate.label },
  });
  const chooseGallery = (item: NewsletterGalleryImage) => {
    onPatch({
      imageUrl: item.url,
      altText: item.altText || block.altText || "",
      imageLink: item.destinationUrl || block.imageLink || "",
      imageIsVideo: false,
      imageSelection: {
        mode: item.source === "AI" ? "AI" : "GALLERY",
        assetId: item.assetId,
        assetSource: item.source,
        sourceLabel: item.label,
        attribution: item.attribution,
      },
    });
    setLibraryOpen(false);
  };
  async function uploadImage(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const response = await fetch("/api/admin/newsletters/images/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The image could not be prepared.");
      const uploaded = await fetch(data.upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": data.upload.contentType },
        body: file,
      });
      if (!uploaded.ok) throw new Error("The image upload did not complete.");
      const fallbackAlt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      onPatch({
        imageUrl: data.upload.publicUrl,
        altText: block.altText?.trim() || fallbackAlt,
        imageIsVideo: false,
        imageSelection: { mode: "CUSTOM", sourceLabel: "Uploaded by administrator" },
      });
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  return <section className="space-y-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
    <div><p className="text-[0.54rem] font-semibold uppercase tracking-[.14em] text-white/30">Image Source</p><p className="mt-2 text-sm text-white/45">{mode === "NONE" ? "No image — intentionally disabled" : block.imageSelection?.sourceLabel || (mode === "CUSTOM" ? "Custom administrator image" : candidates.length ? "Suggested from verified source" : "No verified source image available")}</p></div>
    {block.imageUrl && mode !== "NONE" && <div className="relative aspect-[16/8] overflow-hidden rounded-lg"><Image unoptimized fill src={block.imageUrl} alt={block.altText || "Selected newsletter image"} className="object-cover" /></div>}
    <div className="flex flex-wrap gap-2">
      {candidates[0] && <button type="button" className="admin-btn-secondary" onClick={() => choose(candidates[0])}>Use source image</button>}
      <label className={`admin-btn-secondary cursor-pointer ${uploading ? "pointer-events-none opacity-50" : ""}`}>{uploading ? "Uploading…" : "Upload image"}<input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} /></label>
      <button type="button" className="admin-btn-secondary" onClick={() => { setLibraryTab("gallery"); setLibraryOpen(true); }}>Browse gallery</button>
      <button type="button" className="admin-btn-secondary" onClick={() => { setLibraryTab("generate"); setLibraryOpen(true); }}>Generate with AI</button>
      <button type="button" className="admin-btn-secondary" onClick={() => onPatch({ imageUrl: "", altText: "", imageLink: "", imageIsVideo: false, imageSelection: { mode: "CUSTOM" } })}>Custom URL</button>
      <button type="button" className="admin-btn-secondary" onClick={() => onPatch({ imageUrl: "", altText: "", imageLink: "", imageIsVideo: false, imageSelection: { mode: "NONE" } })}>No image</button>
    </div>
    {uploadError && <p role="alert" className="rounded-lg border border-red-300/20 bg-red-300/[0.06] px-3 py-2 text-xs text-red-100/80">{uploadError}</p>}
    {candidates.length > 1 && <div><p className="mb-2 text-xs text-white/35">Choose another approved source image</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{candidates.map(candidate => <button key={candidate.id} type="button" title={`${candidate.label} · ${candidate.role}`} onClick={() => choose(candidate)} className={`relative aspect-[4/3] overflow-hidden rounded-lg border ${block.imageSelection?.candidateId === candidate.id ? "border-[var(--helios-orange)]" : "border-white/10"}`}><Image unoptimized fill src={candidate.thumbnailUrl || candidate.url} alt={candidate.altText || candidate.label} className="object-cover" /><span className="absolute inset-x-0 bottom-0 bg-black/75 px-2 py-1 text-left text-[9px] text-white/70">{candidate.label}</span></button>)}</div></div>}
    {(mode === "CUSTOM" || (!candidates.length && mode !== "NONE")) && <label className="block text-xs text-white/40">Custom public HTTPS image URL<input type="url" className={input} value={block.imageUrl || ""} placeholder="https://…" onChange={event => onPatch({ imageUrl: event.target.value, imageSelection: { mode: "CUSTOM", sourceLabel: "Custom image supplied by administrator" } })} /><span className="mt-2 block text-[11px] text-white/25">The image must remain publicly accessible over HTTPS.</span></label>}
    {mode !== "NONE" && <details><summary className="cursor-pointer text-xs text-white/40">Advanced image details</summary><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/40">Alt text<input className={input} value={block.altText || ""} onChange={event => onPatch({ altText: event.target.value })} /></label><label className="text-xs text-white/40">Linked destination<input type="url" className={input} value={block.imageLink || ""} onChange={event => onPatch({ imageLink: event.target.value })} /></label></div></details>}
    {block.imageSelection?.attribution && mode !== "NONE" && <p className="text-[11px] text-white/25">Attribution: {block.imageSelection.attribution}</p>}
    {libraryOpen && <ImageLibraryDialog open initialTab={libraryTab} initialPrompt={blockDirection} contextLabel={block.label} onClose={() => setLibraryOpen(false)} onChoose={chooseGallery} />}
  </section>;
}
