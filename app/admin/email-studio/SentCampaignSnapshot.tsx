"use client";

import { normalizeEmailTemplateKey, renderFormattedEmailBody } from "@/lib/client-communications/email-format";

type SnapshotBlock = {
  type?: string;
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  altText?: string | null;
  imageLink?: string | null;
  linkUrl?: string | null;
  link?: string | null;
  buttonLabel?: string | null;
};

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function parseSentSnapshot(body: string): { blocks: SnapshotBlock[]; technicalPayload: string } | null {
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== "object" || !("blocks" in value) || !Array.isArray(value.blocks)) return null;
    return {
      blocks: value.blocks.filter((block): block is SnapshotBlock => Boolean(block) && typeof block === "object"),
      technicalPayload: JSON.stringify(value, null, 2),
    };
  } catch {
    return null;
  }
}

export default function SentCampaignSnapshot({ body, templateKey, imageUrl, imageAlt, imageCaption, imageLink }: { body: string; templateKey?: string | null; imageUrl?: string | null; imageAlt?: string | null; imageCaption?: string | null; imageLink?: string | null }) {
  const snapshot = parseSentSnapshot(body);
  if (!snapshot) {
    const template = normalizeEmailTemplateKey(templateKey);
    const light = template === "EDITORIAL_LIGHT" || template === "PERSONAL_LETTER";
    const colors = light ? { background: "#f7f3eb", text: "#4f4942", heading: "#211f1c" } : { background: "#121211", text: "#d7d1c8", heading: "#f5f1e8" };
    const campaignImageUrl = safeUrl(imageUrl);
    const campaignImageLink = safeUrl(imageLink);
    const campaignImage = campaignImageUrl
      // The immutable campaign record supplies the historical image URL.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={campaignImageUrl} alt={imageAlt ?? ""} className="h-auto w-full" />
      : null;
    return <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/30 p-5">
      <p className="text-[0.56rem] font-semibold uppercase tracking-[.16em] text-[var(--helios-orange)]">Sent message · {template.replaceAll("_", " ")}</p>
      <div className="mt-4 p-6" style={{ background: colors.background }}>{campaignImage && (campaignImageLink ? <a href={campaignImageLink} target="_blank" rel="noreferrer">{campaignImage}</a> : campaignImage)}{imageCaption && <p className="mt-2 text-xs leading-5 opacity-60" style={{ color: colors.text }}>{imageCaption}</p>}<div className={campaignImage ? "mt-5" : ""} dangerouslySetInnerHTML={{ __html: renderFormattedEmailBody(body || "This historical message has no readable body snapshot.", { textColor: colors.text, mutedColor: colors.text, headingColor: colors.heading }) }} /></div>
    </div>;
  }
  if (!snapshot.blocks.length) {
    return <>
      <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-5 text-sm leading-6 text-amber-100/60">The immutable snapshot is present, but its content blocks are unavailable. Technical details remain below for diagnosis.</div>
      <TechnicalDetails payload={snapshot.technicalPayload} />
    </>;
  }
  return <>
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.09] bg-[#f3eee4] text-[#25211d]">
      <div className="bg-[#171716] px-6 py-5 text-xs font-semibold uppercase tracking-[.18em] text-[#f3eee4]">Helios Real Estate Media</div>
      {snapshot.blocks.map((block, index) => {
        if (block.type === "DIVIDER") return <hr key={index} className="mx-6 my-5 border-[#d6cfc3]" />;
        if (block.type === "SPACER") return <div key={index} aria-hidden="true" className="h-8" />;
        const imageUrl = safeUrl(block.imageUrl);
        const destination = safeUrl(block.linkUrl ?? block.link);
        const imageDestination = safeUrl(block.imageLink);
        const image = imageUrl
          // The immutable provider payload supplies the exact historical image URL.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={imageUrl} alt={block.imageAlt ?? block.altText ?? ""} className="max-h-[32rem] w-full object-cover" />
          : null;
        return <section key={index} className="border-b border-[#ded7cb] last:border-0">
          {image && (imageDestination ? <a href={imageDestination} target="_blank" rel="noreferrer">{image}</a> : image)}
          <div className={`px-6 py-7 sm:px-9 ${block.type === "CALL_TO_ACTION" ? "text-center" : ""}`}>
            {block.eyebrow && <p className="text-[0.65rem] font-bold uppercase tracking-[.17em] text-[#c45f29]">{block.eyebrow}</p>}
            {block.heading && <h3 className="mt-2 font-serif text-2xl font-normal leading-tight sm:text-3xl">{block.heading}</h3>}
            {block.body && <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#5a554f]">{block.body}</div>}
            {destination && block.buttonLabel && <a href={destination} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded bg-[#171716] px-5 py-3 text-xs font-semibold uppercase tracking-[.12em] text-white">{block.buttonLabel}</a>}
          </div>
        </section>;
      })}
    </div>
    <TechnicalDetails payload={snapshot.technicalPayload} />
  </>;
}

function TechnicalDetails({ payload }: { payload: string }) {
  return <details className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4">
    <summary className="cursor-pointer text-xs text-white/45">Technical details</summary>
    <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[0.68rem] leading-5 text-white/30">{payload}</pre>
  </details>;
}
