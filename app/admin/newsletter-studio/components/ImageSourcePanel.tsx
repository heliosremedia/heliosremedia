"use client";

import Image from "next/image";
import type { NewsletterBlock } from "../types";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-[var(--helios-orange)]";

export default function ImageSourcePanel({ block, onPatch }: {
  block: NewsletterBlock;
  onPatch: (values: Partial<NewsletterBlock>) => void;
}) {
  const candidates = block.imageCandidates ?? [];
  const mode = block.imageSelection?.mode ?? (block.imageUrl ? "CUSTOM" : "AUTO");
  const choose = (candidate: NonNullable<NewsletterBlock["imageCandidates"]>[number]) => onPatch({
    imageUrl: candidate.url,
    altText: candidate.altText || block.altText || "",
    imageLink: candidate.destinationUrl || block.imageLink || "",
    imageIsVideo: candidate.isVideo,
    imageSelection: { mode: "SOURCE", candidateId: candidate.id, sourceLabel: candidate.label },
  });
  return <section className="space-y-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
    <div><p className="text-[0.54rem] font-semibold uppercase tracking-[.14em] text-white/30">Image Source</p><p className="mt-2 text-sm text-white/45">{mode === "NONE" ? "No image — intentionally disabled" : block.imageSelection?.sourceLabel || (mode === "CUSTOM" ? "Custom administrator image" : candidates.length ? "Suggested from verified source" : "No verified source image available")}</p></div>
    {block.imageUrl && mode !== "NONE" && <div className="relative aspect-[16/8] overflow-hidden rounded-lg"><Image unoptimized fill src={block.imageUrl} alt={block.altText || "Selected newsletter image"} className="object-cover" /></div>}
    <div className="flex flex-wrap gap-2">
      {candidates[0] && <button type="button" className="admin-btn-secondary" onClick={() => choose(candidates[0])}>Use source image</button>}
      <button type="button" className="admin-btn-secondary" onClick={() => onPatch({ imageUrl: "", altText: "", imageLink: "", imageIsVideo: false, imageSelection: { mode: "CUSTOM" } })}>Custom URL</button>
      <button type="button" className="admin-btn-secondary" onClick={() => onPatch({ imageUrl: "", altText: "", imageLink: "", imageIsVideo: false, imageSelection: { mode: "NONE" } })}>No image</button>
    </div>
    {candidates.length > 1 && <div><p className="mb-2 text-xs text-white/35">Choose another approved source image</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{candidates.map(candidate => <button key={candidate.id} type="button" title={`${candidate.label} · ${candidate.role}`} onClick={() => choose(candidate)} className={`relative aspect-[4/3] overflow-hidden rounded-lg border ${block.imageSelection?.candidateId === candidate.id ? "border-[var(--helios-orange)]" : "border-white/10"}`}><Image unoptimized fill src={candidate.thumbnailUrl || candidate.url} alt={candidate.altText || candidate.label} className="object-cover" /><span className="absolute inset-x-0 bottom-0 bg-black/75 px-2 py-1 text-left text-[9px] text-white/70">{candidate.label}</span></button>)}</div></div>}
    {(mode === "CUSTOM" || (!candidates.length && mode !== "NONE")) && <label className="block text-xs text-white/40">Custom public HTTPS image URL<input type="url" className={input} value={block.imageUrl || ""} placeholder="https://…" onChange={event => onPatch({ imageUrl: event.target.value, imageSelection: { mode: "CUSTOM", sourceLabel: "Custom image supplied by administrator" } })} /><span className="mt-2 block text-[11px] text-white/25">The image must remain publicly accessible over HTTPS.</span></label>}
    {mode !== "NONE" && <details><summary className="cursor-pointer text-xs text-white/40">Advanced image details</summary><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/40">Alt text<input className={input} value={block.altText || ""} onChange={event => onPatch({ altText: event.target.value })} /></label><label className="text-xs text-white/40">Linked destination<input type="url" className={input} value={block.imageLink || ""} onChange={event => onPatch({ imageLink: event.target.value })} /></label></div></details>}
  </section>;
}
