"use client";
import Image from "next/image";
import { NEWSLETTER_CTA } from "@/lib/newsletters/presentation";
import type { NewsletterEdition } from "../types";

function Artwork({ block }: { block: NewsletterEdition["blocks"][number] }) {
  if (!block.imageUrl) return null;
  const image = <Image unoptimized width={640} height={360} src={block.imageUrl} alt={block.altText || ""} className="aspect-[16/9] w-full object-cover" />;
  return <div className="relative mb-6 overflow-hidden rounded-lg">
    {block.imageLink ? <a href={block.imageLink} tabIndex={-1}>{image}</a> : image}
    {block.imageIsVideo && <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-lg text-white">▶</span>}
  </div>;
}

export default function NewsletterPreview({ edition, mode }: { edition: NewsletterEdition; mode: "desktop" | "mobile" }) {
  return <div className={`mx-auto overflow-hidden rounded-xl border border-black/10 bg-[#f2eee5] shadow-2xl transition-[max-width] ${mode === "mobile" ? "max-w-[390px]" : "max-w-[680px]"}`}>
    <div className="bg-[#171717] px-6 py-5 text-center"><p className="font-helios text-lg tracking-[.15em] text-white">HELIOS</p><p className="mt-1 text-[9px] uppercase tracking-[.22em] text-[#d96b2b]">Real Estate Media</p></div>
    <div className="bg-[#f2eee5] text-[#23201d]">{edition.blocks.map(block => <section key={block.id} className={`${block.type === "DIVIDER" || block.type === "SPACER" ? "px-8 py-4" : "px-7 py-7 sm:px-10"} ${block.alignment === "center" ? "text-center" : "text-left"}`}>
      {block.type === "DIVIDER" ? <hr className="border-[#23201d]/15" /> : block.type === "SPACER" ? <div className="h-6" /> : <><Artwork block={block} />{block.eyebrow && <p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#c75f28]">{block.eyebrow}</p>}{block.heading && <h2 className="mt-2 font-serif text-[clamp(1.55rem,5vw,2.4rem)] font-normal leading-tight">{block.heading}</h2>}{block.body && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-[#39332e]">{block.body}</p>}{block.link && block.buttonLabel && <a href={block.link} tabIndex={-1} className="mt-6 inline-block px-5 py-3 text-[10px] font-bold uppercase tracking-[.13em]" style={NEWSLETTER_CTA}>{block.buttonLabel}</a>}</>}</section>)}</div>
    <footer className="bg-[#171717] px-7 py-7 text-center text-[10px] leading-5 text-white/45"><p>Helios Real Estate Media</p><p className="mt-2">You are receiving this email because you subscribed to Helios updates.</p><p className="mt-2 underline">Unsubscribe</p></footer>
  </div>;
}
