"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type Media = { id: string; url: string; altText: string; mimeType: string | null; project: string; aspectRatio: number | null };
type VariantMedia = { id: string; mediaId: string; altText: string; cropAspect: string | null; media: Media };
type Variant = { id: string; platform: string; postType: string; status: string; caption: string; openingHook: string; hashtags: string[]; callToAction: string; destinationLink: string; altText: string; onScreenText: string; videoConcept: string; platformNotes: string; internalNotes: string; scheduledLocal: string; media: VariantMedia[]; suggestedCover: string; publicUrl: string; publishedAt: string | null };
type Campaign = { id: string; internalName: string; purpose: string; targetAudience: string; primaryMessage: string; sourceType: string; verifiedSourceFacts: Record<string, unknown>; generationStatus: string | null; generationError: string | null; variants: Variant[] };
type Connection = { id:string; platform:string; label:string };

const postTypes: Record<string, string[]> = {
  INSTAGRAM: ["SINGLE_IMAGE","CAROUSEL","REEL","STORY_CONCEPT"],
  FACEBOOK: ["TEXT_POST","IMAGE_POST","MULTI_IMAGE_POST","VIDEO_POST","LINK_POST"],
  LINKEDIN: ["TEXT_POST","IMAGE_POST","MULTI_IMAGE_CONCEPT","VIDEO_POST","LINK_POST"],
  TIKTOK: ["VIDEO_POST","PHOTO_POST_CONCEPT","DRAFT_EXPORT"],
  OTHER: ["CAPTION_AND_MEDIA","TEXT_POST","VIDEO_CONCEPT"],
};
const aspectClasses: Record<string, string> = { "1:1": "aspect-square", "4:5": "aspect-[4/5]", "9:16": "aspect-[9/16]", "16:9": "aspect-video" };
const actionMessages: Record<string, string> = {
  "submit-review": "Variant submitted for review.",
  approve: "Variant approved.",
  schedule: "Variant scheduled.",
  publish: "Variant marked as published.",
  "request-changes": "Changes requested.",
  "set-media": "Selected media updated.",
  archive: "Variant archived.",
  "archive-campaign": "Campaign archived.",
};

export default function SocialCampaignEditor({ initialCampaign, library, connections }: { initialCampaign: Campaign; library: Media[]; connections:Connection[] }) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [active, setActive] = useState(() => {
    const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("variant");
    return requested && initialCampaign.variants.some((item) => item.id === requested) ? requested : initialCampaign.variants[0]?.id || "";
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("social-action-confirmation") || "";
  });
  const [mediaOpen, setMediaOpen] = useState(false);
  const [aspect, setAspect] = useState("4:5");
  const [connectionId,setConnectionId]=useState("");
  const variant = campaign.variants.find((item) => item.id === active)!;
  const published = variant.status === "PUBLISHED";
  const patchVariant = (key: keyof Variant, value: Variant[keyof Variant]) => setCampaign((current) => ({ ...current, variants: current.variants.map((item) => item.id === active ? { ...item, [key]: value } : item) }));
  async function action(actionName: string, extra: Record<string, unknown> = {}) {
    window.sessionStorage.removeItem("social-action-confirmation");
    setBusy(actionName); setMessage("");
    try {
      const response = await fetch(`/api/admin/social/campaigns/${campaign.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, variantId: variant.id, ...variant, ...extra }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The action could not be completed.");
      if (actionName === "duplicate-campaign" && data.campaignId) {
        window.location.href = `/admin/social-studio/campaigns/${data.campaignId}`;
        return;
      }
      const confirmation = actionMessages[actionName] || `${actionName.replaceAll("-", " ")} completed.`;
      setMessage(confirmation);
      if (["approve","schedule","publish","archive","archive-campaign","submit-review","request-changes","set-media"].includes(actionName)) {
        window.sessionStorage.setItem("social-action-confirmation", confirmation);
        window.location.reload();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "The action could not be completed."); } finally { setBusy(""); }
  }
  async function generate(actionName = "create-platform-variants") {
    setBusy("ai"); setMessage("AI is preparing platform-specific drafts…");
    try {
      const requestId = crypto.randomUUID();
      const response = await fetch("/api/admin/social/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: campaign.id, variantId: ["create-platform-variants", "campaign-brief"].includes(actionName) ? undefined : variant.id, action: actionName, requestId }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "AI generation failed.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "AI generation failed."); setBusy(""); }
  }
  async function generateImage() {
    const prompt = window.prompt("Creative direction for this clearly labeled AI concept image:");
    if (!prompt) return;
    const altText = window.prompt("Accessible alt text for the generated concept image:");
    if (!altText) return;
    setBusy("image"); setMessage("Generating a disclosed concept image… this may take up to two minutes.");
    try {
      const response = await fetch("/api/admin/social/images/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, altText }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Image generation failed.");
      await action("set-ai-image", data.image);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Image generation failed."); setBusy(""); }
  }
  const input = "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]";
  return <div className="space-y-7 pb-10">
    <section className="flex flex-col gap-5 border-b border-white/[.08] pb-7 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/admin/social-studio" className="text-xs text-white/35 hover:text-white">← Social Studio</Link><p className="eyebrow mt-5 text-[var(--helios-orange)]">{campaign.sourceType.replaceAll("_", " ")} campaign</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">{campaign.internalName}</h1><p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-white/40">{campaign.purpose || "No campaign brief supplied."}</p></div><div className="flex flex-wrap gap-2"><button disabled={Boolean(busy)} onClick={() => action("duplicate-campaign")} className="admin-btn-secondary">Duplicate</button><button disabled={Boolean(busy)} onClick={() => action("archive-campaign")} className="admin-btn-secondary">Archive</button><button disabled={Boolean(busy)} onClick={() => generate("campaign-brief")} className="admin-btn-secondary">AI campaign brief</button><button disabled={Boolean(busy)} onClick={() => generate()} className="admin-btn-primary">{busy === "ai" ? "Creating drafts…" : "Create platform variants"}</button></div></section>
    <section className="rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[.04] p-4"><p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--helios-orange)]">Verified source facts</p><p className="mt-2 text-sm leading-6 text-white/50">AI receives only this source snapshot as publishable facts. Internal instructions remain separate.</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(campaign.verifiedSourceFacts || {}).filter(([, value]) => ["string","number"].includes(typeof value)).slice(0, 10).map(([key, value]) => <span key={key} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/40">{key}: {String(value)}</span>)}</div></section>
    <div className="grid gap-6 xl:grid-cols-[13rem_minmax(0,1fr)_22rem]">
      <nav aria-label="Platform variants" className="space-y-2">{campaign.variants.map((item) => <button key={item.id} onClick={() => setActive(item.id)} className={`w-full rounded-xl border p-4 text-left ${item.id === active ? "border-[var(--helios-orange)]/35 bg-[var(--helios-orange)]/[.06]" : "border-white/[.08] bg-white/[.02]"}`}><span className="block text-sm text-white/75">{item.platform}</span><span className="mt-2 block text-[.58rem] uppercase tracking-[.14em] text-white/30">{item.status.replaceAll("_", " ")}</span></button>)}</nav>
      <section className="min-w-0 rounded-2xl border border-white/[.08] bg-white/[.02] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow text-[var(--helios-orange)]">{variant.platform}</p><h2 className="mt-2 text-2xl font-light text-white">Post editor</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-[.6rem] uppercase tracking-[.13em] text-white/40">{variant.status.replaceAll("_", " ")}</span></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-xs text-white/40">Post type<select className={input} value={variant.postType} onChange={(e) => patchVariant("postType", e.target.value)}>{postTypes[variant.platform].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs text-white/40">Opening hook<input className={input} value={variant.openingHook} onChange={(e) => patchVariant("openingHook", e.target.value)}/></label>
        <label className="text-xs text-white/40 sm:col-span-2">Caption or post copy<textarea rows={10} className={input} value={variant.caption} onChange={(e) => patchVariant("caption", e.target.value)}/><span className="mt-2 block text-[.65rem] text-white/25">{variant.caption.length.toLocaleString()} characters · guidance only, not provider validation</span></label><label className="text-xs text-white/40 sm:col-span-2">Hashtags<input className={input} value={variant.hashtags.join(" ")} onChange={(e) => patchVariant("hashtags", e.target.value.split(/\s+/).filter(Boolean))}/></label><label className="text-xs text-white/40">Call to action<input className={input} value={variant.callToAction} onChange={(e) => patchVariant("callToAction", e.target.value)}/></label><label className="text-xs text-white/40">Destination link<input className={input} value={variant.destinationLink} onChange={(e) => patchVariant("destinationLink", e.target.value)}/></label><label className="text-xs text-white/40 sm:col-span-2">Alt text<textarea rows={3} className={input} value={variant.altText} onChange={(e) => patchVariant("altText", e.target.value)}/></label>
        {["INSTAGRAM","TIKTOK"].includes(variant.platform) && <><label className="text-xs text-white/40 sm:col-span-2">On-screen text suggestion<textarea rows={3} className={input} value={variant.onScreenText} onChange={(e) => patchVariant("onScreenText", e.target.value)}/></label><label className="text-xs text-white/40 sm:col-span-2">Video or Reel concept<textarea rows={5} className={input} value={variant.videoConcept} onChange={(e) => patchVariant("videoConcept", e.target.value)}/></label></>}</div>
        {published && <p className="mt-5 rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm text-white/50">Published posts are locked to preserve the exact publication record. Create a new campaign or variant revision for changes.</p>}
        <div className="mt-6 flex flex-wrap gap-2"><button disabled={Boolean(busy) || published} onClick={() => action("update-variant")} className="admin-btn-primary">{busy === "update-variant" ? "Saving…" : "Save changes"}</button><button disabled={Boolean(busy) || published} onClick={() => generate("alternate-hook")} className="admin-btn-secondary">Alternate hook</button><button disabled={Boolean(busy) || published} onClick={() => generate("shorten")} className="admin-btn-secondary">Shorten</button><button disabled={Boolean(busy) || published} onClick={() => generate("adjust-tone")} className="admin-btn-secondary">Adjust tone</button><button disabled={Boolean(busy) || published} onClick={() => generate("suggest-hashtags")} className="admin-btn-secondary">Suggest hashtags</button></div>
        <div className="mt-7 border-t border-white/[.08] pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-light text-white">Selected media</h3><p className="mt-1 text-xs text-white/30">Presentation crops never modify the original asset.</p></div><div className="flex gap-2"><button disabled={Boolean(busy) || published} onClick={generateImage} className="admin-btn-secondary">{busy === "image" ? "Generating…" : "Generate concept image"}</button><button disabled={published} onClick={() => setMediaOpen(true)} className="admin-btn-secondary">Choose media</button></div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{variant.suggestedCover && <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--helios-orange)]/30"><Image src={variant.suggestedCover} alt={variant.altText || "AI-generated social concept"} fill unoptimized className="object-cover"/><span className="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-[.55rem] text-white/70">AI-generated concept · not Helios photography</span></div>}{variant.media.map((item) => <div key={item.id} className="relative aspect-square overflow-hidden rounded-xl border border-white/10"><Image src={item.media.url} alt={item.altText || item.media.altText} fill unoptimized className="object-cover"/></div>)}{!variant.media.length && !variant.suggestedCover && <p className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/30">No media selected.</p>}</div><Link href="/admin/media" className="mt-3 inline-block text-xs text-white/35 hover:text-white">Upload new media in Media Library →</Link></div>
        <div className="mt-7 border-t border-white/[.08] pt-6"><h3 className="text-lg font-light text-white">Review & schedule</h3><div className="mt-4 flex flex-wrap gap-2"><button disabled={Boolean(busy) || published} onClick={() => action("submit-review")} className="admin-btn-secondary">Submit for review</button><button disabled={Boolean(busy) || variant.status !== "NEEDS_REVIEW"} onClick={() => action("request-changes", { reason: window.prompt("What should change?") || "" })} className="admin-btn-secondary">Request changes</button><button disabled={Boolean(busy) || variant.status !== "NEEDS_REVIEW"} onClick={() => action("approve")} className="admin-btn-primary">Approve variant</button></div><label className="mt-5 block text-xs text-white/40">Mountain Time schedule<input type="datetime-local" className={input} value={variant.scheduledLocal} onChange={(e) => patchVariant("scheduledLocal", e.target.value)}/></label><button disabled={Boolean(busy) || !["APPROVED","SCHEDULED","READY_TO_PUBLISH"].includes(variant.status)} onClick={() => action("schedule", { timeZone: "America/Denver" })} className="admin-btn-secondary mt-3">Schedule</button>
        {variant.status==="SCHEDULED"&&connections.some(item=>item.platform===variant.platform)&&<div className="mt-5 rounded-xl border border-white/10 bg-white/[.02] p-4"><p className="text-sm text-white/65">Optional direct publishing</p><p className="mt-2 text-xs leading-5 text-white/35">This post remains manual unless you deliberately select an enabled account. Social Studio will lock the exact approved revision.</p><div className="mt-3 flex flex-wrap gap-2"><select aria-label="Direct publishing account" className={input} value={connectionId} onChange={e=>setConnectionId(e.target.value)}><option value="">Choose enabled account…</option>{connections.filter(item=>item.platform===variant.platform).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><button disabled={!connectionId||Boolean(busy)} onClick={()=>action("enable-direct-publishing",{connectionId})} className="admin-btn-primary">Use direct publishing for this post</button></div></div>}
        {["READY_TO_PUBLISH","SCHEDULED"].includes(variant.status) && <div className="mt-5 rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[.04] p-4"><p className="text-sm text-white/65">Manual publishing checklist</p><ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-white/40"><li>Confirm the intended account and platform.</li><li>Copy caption and hashtags.</li><li>Download or open selected media.</li><li>Publish on the platform, then record the result.</li></ol><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(variant.caption)} className="admin-btn-secondary">Copy caption</button><button onClick={() => navigator.clipboard.writeText(variant.hashtags.join(" "))} className="admin-btn-secondary">Copy hashtags</button><a href={`https://www.${variant.platform.toLowerCase()}.com/`} target="_blank" rel="noreferrer" className="admin-btn-secondary">Open platform</a><button onClick={() => action("publish", { publishedAt: new Date().toISOString(), publicUrl: variant.publicUrl })} className="admin-btn-primary">Mark published</button></div></div>}</div>
        {message && <p role="status" aria-live="polite" className="mt-5 text-sm text-white/55">{message}</p>}
      </section>
      <aside className="rounded-2xl border border-white/[.08] bg-[#101012] p-4"><div className="flex gap-2">{["1:1","4:5","9:16","16:9"].map((item) => <button key={item} onClick={() => setAspect(item)} className={`rounded-full px-3 py-1 text-[.58rem] ${aspect === item ? "bg-white/10 text-white" : "text-white/30"}`}>{item}</button>)}</div><div className={`mx-auto mt-4 max-h-[34rem] overflow-hidden rounded-xl border border-white/10 bg-black ${aspectClasses[aspect]}`}>{variant.media[0] || variant.suggestedCover ? <Image src={variant.media[0]?.media.url || variant.suggestedCover} alt={variant.altText || variant.media[0]?.media.altText || "Social post preview"} width={600} height={800} unoptimized className="h-full w-full object-cover"/> : <div className="flex h-full min-h-52 items-center justify-center text-xs text-white/25">Media preview</div>}</div><p className="mt-4 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-white/60">{variant.caption || "Caption preview"}</p><p className="mt-2 text-xs text-[var(--helios-orange)]/70">{variant.hashtags.join(" ")}</p><p className="mt-4 text-[.62rem] leading-5 text-white/25">Approximate preview only. Final rendering and truncation vary by platform.</p></aside>
    </div>
    {mediaOpen && <MediaPicker library={library} selected={variant.media.map((item) => item.mediaId)} onClose={() => setMediaOpen(false)} onSave={(mediaIds) => action("set-media", { mediaIds })}/>}
  </div>;
}

function MediaPicker({ library, selected, onClose, onSave }: { library: Media[]; selected: string[]; onClose: () => void; onSave: (ids: string[]) => void }) {
  const [chosen, setChosen] = useState(selected); const [search, setSearch] = useState("");
  const matches = library.filter((item) => `${item.project} ${item.altText}`.toLowerCase().includes(search.toLowerCase()));
  return <div role="dialog" aria-modal="true" aria-labelledby="media-picker-title" className="fixed inset-0 z-[110] overflow-y-auto bg-black/90 p-4"><div className="mx-auto my-4 max-w-6xl rounded-2xl border border-white/10 bg-[#121214] p-6"><div className="flex justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Shared gallery</p><h2 id="media-picker-title" className="mt-2 text-2xl font-light text-white">Choose media</h2></div><button onClick={onClose} className="admin-btn-secondary">Close</button></div><label className="mt-5 block text-xs text-white/40">Search project or alt text<input className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white" value={search} onChange={(e) => setSearch(e.target.value)}/></label><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{matches.map((item) => <button key={item.id} onClick={() => setChosen((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className={`overflow-hidden rounded-xl border text-left ${chosen.includes(item.id) ? "border-[var(--helios-orange)]" : "border-white/10"}`}><div className="relative aspect-square"><Image src={item.url} alt={item.altText} fill unoptimized className="object-cover"/></div><p className="truncate p-2 text-xs text-white/45">{item.project}</p></button>)}</div><div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="admin-btn-secondary">Cancel</button><button onClick={() => onSave(chosen)} className="admin-btn-primary">Use {chosen.length} asset{chosen.length === 1 ? "" : "s"}</button></div></div></div>;
}
