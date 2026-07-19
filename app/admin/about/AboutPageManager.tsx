"use client";

import { useState } from "react";
import Image from "next/image";

import type { AboutListItem, PublicAboutPageContent } from "@/lib/about-page";

type ImageKind = "hero" | "gallery-one" | "gallery-two" | "gallery-three";
type ImagePrefix = "heroImage" | "galleryOne" | "galleryTwo" | "galleryThree";

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "The request could not be completed.");
  return data;
}

export default function AboutPageManager({ initialContent }: { initialContent: PublicAboutPageContent }) {
  const [content, setContent] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function field<K extends keyof PublicAboutPageContent>(key: K, value: PublicAboutPageContent[K]) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  async function upload(kind: ImageKind, prefix: ImagePrefix, file: File) {
    setBusy(true); setMessage("");
    try {
      const data = await jsonRequest("/api/admin/about/presign", { method: "POST", body: JSON.stringify({ kind, fileType: file.type, fileSize: file.size }) });
      const uploadResponse = await fetch(data.upload.uploadUrl, { method: "PUT", headers: { "Content-Type": data.upload.contentType }, body: file });
      if (!uploadResponse.ok) throw new Error("The image could not be uploaded.");
      setContent((current) => ({ ...current, [`${prefix}StorageKey`]: data.upload.key, [`${prefix}Url`]: data.upload.publicUrl }));
      setMessage("Image uploaded. Save the About page to publish it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The image could not be uploaded."); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setMessage("");
    try {
      await jsonRequest("/api/admin/about", { method: "PATCH", body: JSON.stringify(content) });
      setMessage("About page saved and published.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The About page could not be saved."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-7">
    {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/55">{message}</p>}

    <Panel eyebrow="Opening frame" title="Hero" description="Control the first image and message visitors see on the About page.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4"><Input label="Eyebrow" value={content.heroEyebrow} onChange={(value) => field("heroEyebrow", value)} /><Textarea label="Headline" value={content.heroHeadline} onChange={(value) => field("heroHeadline", value)} rows={3} /><Textarea label="Introduction" value={content.heroBody} onChange={(value) => field("heroBody", value)} rows={5} /></div>
        <ImageField label="Hero image" value={content.heroImageUrl} alt={content.heroImageAlt} onAlt={(value) => field("heroImageAlt", value)} onFile={(file) => upload("hero", "heroImage", file)} busy={busy} />
      </div>
    </Panel>

    <Panel eyebrow="Narrative" title="Why we exist" description="Curate the positioning statement and the two supporting paragraphs.">
      <div className="grid gap-4 lg:grid-cols-2"><Input label="Eyebrow" value={content.storyEyebrow} onChange={(value) => field("storyEyebrow", value)} /><Textarea label="Intro" value={content.storyIntro} onChange={(value) => field("storyIntro", value)} rows={5} /><Textarea label="Large statement" value={content.storyHeadline} onChange={(value) => field("storyHeadline", value)} rows={5} /><div /><Textarea label="Supporting copy — left" value={content.storyBodyLeft} onChange={(value) => field("storyBodyLeft", value)} rows={7} /><Textarea label="Supporting copy — right" value={content.storyBodyRight} onChange={(value) => field("storyBodyRight", value)} rows={7} /></div>
    </Panel>

    <Panel eyebrow="Point of view" title="Principles" description="Edit the section heading and each principle card.">
      <div className="grid gap-4 lg:grid-cols-3"><Input label="Eyebrow" value={content.principlesEyebrow} onChange={(value) => field("principlesEyebrow", value)} /><Input label="Headline" value={content.principlesHeadline} onChange={(value) => field("principlesHeadline", value)} /><Textarea label="Introduction" value={content.principlesIntro} onChange={(value) => field("principlesIntro", value)} rows={3} /></div>
      <ListEditor items={content.principles} onChange={(items) => field("principles", items)} />
    </Panel>

    <Panel eyebrow="Miniature gallery" title="About imagery" description="These three images preserve the editorial layout while making every frame replaceable.">
      <div className="grid gap-5 lg:grid-cols-3">
        <ImageField label="Large image" value={content.galleryOneUrl} alt={content.galleryOneAlt} onAlt={(value) => field("galleryOneAlt", value)} onFile={(file) => upload("gallery-one", "galleryOne", file)} busy={busy} />
        <ImageField label="Upper image" value={content.galleryTwoUrl} alt={content.galleryTwoAlt} onAlt={(value) => field("galleryTwoAlt", value)} onFile={(file) => upload("gallery-two", "galleryTwo", file)} busy={busy} />
        <ImageField label="Lower image" value={content.galleryThreeUrl} alt={content.galleryThreeAlt} onAlt={(value) => field("galleryThreeAlt", value)} onFile={(file) => upload("gallery-three", "galleryThree", file)} busy={busy} />
      </div>
    </Panel>

    <Panel eyebrow="Workflow" title="Client experience" description="Edit the final narrative section and each process step.">
      <div className="grid gap-4 lg:grid-cols-2"><Input label="Eyebrow" value={content.processEyebrow} onChange={(value) => field("processEyebrow", value)} /><Textarea label="Headline" value={content.processHeadline} onChange={(value) => field("processHeadline", value)} rows={3} /></div>
      <ListEditor items={content.process} onChange={(items) => field("process", items)} />
    </Panel>

    <div className="sticky bottom-4 z-20 flex justify-end rounded-2xl border border-white/10 bg-[#111]/95 p-4 shadow-2xl backdrop-blur"><button type="button" disabled={busy} onClick={() => void save()} className="rounded-full bg-[var(--helios-orange)] px-8 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-45">{busy ? "Saving…" : "Save About page"}</button></div>
  </div>;
}

function Panel({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7"><p className="eyebrow text-[var(--helios-orange)]">{eyebrow}</p><h2 className="mt-2 font-display text-3xl font-light text-white">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/35">{description}</p><div className="mt-7">{children}</div></section>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/30">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>;
}

function Textarea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return <label className="block text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/30">{label}<textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>;
}

function ImageField({ label, value, alt, onAlt, onFile, busy }: { label: string; value: string | null; alt: string; onAlt: (value: string) => void; onFile: (file: File) => void; busy: boolean }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"><p className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/30">{label}</p><div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-white/[0.03]">{value ? <Image src={value} alt="" fill unoptimized sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/20">No image</div>}</div><label className="mt-4 block text-[0.5rem] uppercase tracking-[0.13em] text-white/25">Image alt text<input value={alt} onChange={(event) => onAlt(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm normal-case tracking-normal text-white" /></label><label className="mt-4 inline-flex cursor-pointer rounded-full bg-[var(--helios-orange)] px-5 py-3 text-[0.52rem] font-semibold uppercase tracking-[0.13em] text-black"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} className="sr-only" />{busy ? "Working…" : "Upload image"}</label></div>;
}

function ListEditor({ items, onChange }: { items: AboutListItem[]; onChange: (items: AboutListItem[]) => void }) {
  function update(index: number, key: keyof AboutListItem, value: string) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  return <div className="mt-6 grid gap-4 lg:grid-cols-2">{items.map((item, index) => <article key={index} className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3"><Input label="Number" value={item.number} onChange={(value) => update(index, "number", value)} /><Input label="Title" value={item.title} onChange={(value) => update(index, "title", value)} /></div><div className="mt-3"><Textarea label="Copy" value={item.copy} onChange={(value) => update(index, "copy", value)} rows={4} /></div></article>)}</div>;
}
