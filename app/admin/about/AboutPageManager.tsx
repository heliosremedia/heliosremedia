"use client";

import { useState } from "react";
import Image from "next/image";

import type { AboutListItem, PublicAboutPageContent } from "@/lib/about-page";

type TeamMemberCategory = "LEADERSHIP" | "PRODUCTION" | "POST_PRODUCTION" | "CLIENT_CARE" | "MARKETING" | "OPERATIONS";
const teamMemberCategories: TeamMemberCategory[] = ["LEADERSHIP", "PRODUCTION", "POST_PRODUCTION", "CLIENT_CARE", "MARKETING", "OPERATIONS"];
const teamMemberCategoryLabels: Record<TeamMemberCategory, string> = { LEADERSHIP: "Leadership", PRODUCTION: "Production", POST_PRODUCTION: "Post-production", CLIENT_CARE: "Client care", MARKETING: "Marketing", OPERATIONS: "Operations" };

type ImageKind = "hero" | "founder" | "gallery-one" | "gallery-two" | "gallery-three";
type ImagePrefix = "heroImage" | "founderImage" | "galleryOne" | "galleryTwo" | "galleryThree";

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "The request could not be completed.");
  return data;
}

export default function AboutPageManager({ initialContent, initialTeamMembers }: { initialContent: PublicAboutPageContent; initialTeamMembers: AdminTeamMember[] }) {
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

    <Panel eyebrow="Personal connection" title="Founder profile" description="Introduce the person behind the company. Upload a portrait, edit every line, then publish the section when it is ready.">
      <label className="mb-6 flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <input type="checkbox" checked={content.founderEnabled} onChange={(event) => field("founderEnabled", event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--helios-orange)]" />
        <span><span className="block text-sm font-medium text-white/80">Show founder profile on the About page</span><span className="mt-1 block text-xs leading-5 text-white/35">The section only appears publicly when this is enabled and a portrait has been uploaded.</span></span>
      </label>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <ImageField label="Founder portrait" value={content.founderImageUrl} alt={content.founderImageAlt} onAlt={(value) => field("founderImageAlt", value)} onFile={(file) => upload("founder", "founderImage", file)} busy={busy} aspect="portrait" />
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Input label="Section eyebrow" value={content.founderEyebrow} onChange={(value) => field("founderEyebrow", value)} />
          <Input label="First name in headline" value={content.founderFirstName} onChange={(value) => field("founderFirstName", value)} />
          <Input label="Role line" value={content.founderRole} onChange={(value) => field("founderRole", value)} />
          <Input label="Signature / full name" value={content.founderSignature} onChange={(value) => field("founderSignature", value)} />
          <div className="sm:col-span-2"><Textarea label="Founder story" value={content.founderBody} onChange={(value) => field("founderBody", value)} rows={10} /></div>
          <Input label="Founder title" value={content.founderTitle} onChange={(value) => field("founderTitle", value)} />
          <div className="sm:col-span-2"><Textarea label="Team note beneath profile" value={content.founderTeamNote} onChange={(value) => field("founderTeamNote", value)} rows={4} /></div>
        </div>
      </div>
    </Panel>

    <TeamMemberManager initialTeamMembers={initialTeamMembers} />

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

    <div className="sticky bottom-4 z-20 flex justify-end rounded-2xl border border-white/10 bg-[#111]/95 p-4 shadow-2xl backdrop-blur"><button type="button" disabled={busy} onClick={() => void save()} className="admin-btn-primary px-8 py-4">{busy ? "Saving…" : "Save About page"}</button></div>
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

function ImageField({ label, value, alt, onAlt, onFile, busy, aspect = "landscape" }: { label: string; value: string | null; alt: string; onAlt: (value: string) => void; onFile: (file: File) => void; busy: boolean; aspect?: "landscape" | "portrait" }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"><p className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/30">{label}</p><div className={`relative mt-3 overflow-hidden rounded-xl bg-white/[0.03] ${aspect === "portrait" ? "aspect-[4/5]" : "aspect-[4/3]"}`}>{value ? <Image src={value} alt="" fill unoptimized sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/20">No image</div>}</div><label className="mt-4 block text-[0.5rem] uppercase tracking-[0.13em] text-white/25">Image alt text<input value={alt} onChange={(event) => onAlt(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm normal-case tracking-normal text-white" /></label><label className="mt-4 admin-btn-primary cursor-pointer"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} className="sr-only" />{busy ? "Working…" : "Upload image"}</label></div>;
}

function ListEditor({ items, onChange }: { items: AboutListItem[]; onChange: (items: AboutListItem[]) => void }) {
  function update(index: number, key: keyof AboutListItem, value: string) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  return <div className="mt-6 grid gap-4 lg:grid-cols-2">{items.map((item, index) => <article key={index} className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3"><Input label="Number" value={item.number} onChange={(value) => update(index, "number", value)} /><Input label="Title" value={item.title} onChange={(value) => update(index, "title", value)} /></div><div className="mt-3"><Textarea label="Copy" value={item.copy} onChange={(value) => update(index, "copy", value)} rows={4} /></div></article>)}</div>;
}

export type AdminTeamMember = {
  id: string; name: string; title: string; biography: string; category: TeamMemberCategory;
  portraitStorageKey: string | null; portraitUrl: string | null; portraitAlt: string | null;
  focalX: number; focalY: number; displayOrder: number; visible: boolean;
  createdAt: string | Date; updatedAt: string | Date;
};

type TeamDraft = Omit<AdminTeamMember, "id" | "createdAt" | "updatedAt" | "displayOrder"> & { id: string | null };

const emptyTeamDraft: TeamDraft = { id: null, name: "", title: "", biography: "", category: "PRODUCTION", portraitStorageKey: null, portraitUrl: null, portraitAlt: "", focalX: 0.5, focalY: 0.25, visible: false };

function TeamMemberManager({ initialTeamMembers }: { initialTeamMembers: AdminTeamMember[] }) {
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [draft, setDraft] = useState<TeamDraft | null>(null);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [teamBusy, setTeamBusy] = useState<string | null>(null);
  const [teamMessage, setTeamMessage] = useState("");

  function openTeam(item?: AdminTeamMember) {
    setDraft(item ? { ...item, id: item.id, portraitAlt: item.portraitAlt ?? "" } : { ...emptyTeamDraft });
    setPortraitFile(null); setTeamMessage("");
  }
  async function uploadPortrait(file: File) {
    const data = await jsonRequest("/api/admin/team-members/presign", { method: "POST", body: JSON.stringify({ fileType: file.type, fileSize: file.size }) });
    const upload = data.upload as { key: string; uploadUrl: string; publicUrl: string; contentType: string };
    const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": upload.contentType }, body: file });
    if (!response.ok) throw new Error("The portrait could not be uploaded.");
    return upload;
  }
  async function saveTeam() {
    if (!draft) return;
    setTeamBusy(draft.id ?? "new"); setTeamMessage("");
    try {
      let portraitStorageKey = draft.portraitStorageKey;
      let portraitUrl = draft.portraitUrl;
      if (portraitFile) { const uploaded = await uploadPortrait(portraitFile); portraitStorageKey = uploaded.key; portraitUrl = uploaded.publicUrl; }
      const data = await jsonRequest("/api/admin/team-members", { method: draft.id ? "PATCH" : "POST", body: JSON.stringify({ ...(draft.id ? { teamMemberId: draft.id } : {}), ...draft, portraitStorageKey, portraitUrl }) });
      const saved = data.teamMember as AdminTeamMember;
      setTeamMembers((current) => current.some(({ id }) => id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setDraft(null); setPortraitFile(null); setTeamMessage("Team member saved.");
    } catch (error) { setTeamMessage(error instanceof Error ? error.message : "Unable to save team member."); }
    finally { setTeamBusy(null); }
  }
  async function moveTeam(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= teamMembers.length) return;
    const previous = teamMembers; const reordered = [...teamMembers]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setTeamMembers(reordered); setTeamBusy("order");
    try { await jsonRequest("/api/admin/team-members", { method: "PATCH", body: JSON.stringify({ action: "reorder", teamMemberIds: reordered.map(({ id }) => id) }) }); }
    catch (error) { setTeamMembers(previous); setTeamMessage(error instanceof Error ? error.message : "Unable to save team order."); }
    finally { setTeamBusy(null); }
  }
  async function removeTeam(item: AdminTeamMember) {
    if (!window.confirm(`Permanently delete ${item.name}?`)) return;
    setTeamBusy(item.id);
    try { await jsonRequest(`/api/admin/team-members?teamMemberId=${encodeURIComponent(item.id)}`, { method: "DELETE" }); setTeamMembers((current) => current.filter(({ id }) => id !== item.id)); }
    catch (error) { setTeamMessage(error instanceof Error ? error.message : "Unable to delete team member."); }
    finally { setTeamBusy(null); }
  }

  return <Panel eyebrow="People" title="Team members" description="Create ordered, visible public team profiles with titles, biographies, categories, and uploaded portraits.">
    {teamMessage && <p role="status" className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/50">{teamMessage}</p>}
    <div className="mb-5 flex justify-end"><button type="button" onClick={() => openTeam()} className="admin-btn-primary">Add team member</button></div>
    <div className="grid gap-4 lg:grid-cols-2">{teamMembers.map((item, index) => <article key={item.id} className={`grid gap-4 rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] ${item.visible ? "" : "opacity-60"}`}><div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white/[0.03]">{item.portraitUrl ? <Image src={item.portraitUrl} alt={item.portraitAlt || item.name} fill unoptimized sizes="8rem" className="object-cover grayscale" style={{ objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%` }} /> : <div className="flex h-full items-center justify-center text-4xl text-white/15">{item.name.charAt(0)}</div>}</div><div><div className="flex items-start justify-between gap-3"><div><h3 className="text-white/85">{item.name}</h3><p className="mt-1 text-xs text-white/35">{item.title} · {teamMemberCategoryLabels[item.category]}</p></div><span className="rounded-full border border-white/10 px-2 py-1 text-[0.48rem] uppercase tracking-[0.12em] text-white/35">{item.visible ? "Visible" : "Hidden"}</span></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-white/38">{item.biography}</p><div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3"><button disabled={index === 0 || teamBusy !== null} onClick={() => moveTeam(index, -1)} className="admin-btn-link">↑</button><button disabled={index === teamMembers.length - 1 || teamBusy !== null} onClick={() => moveTeam(index, 1)} className="admin-btn-link">↓</button><button onClick={() => openTeam(item)} className="ml-auto admin-btn-link">Edit</button><button disabled={teamBusy !== null} onClick={() => removeTeam(item)} className="admin-btn-link-destructive">Delete</button></div></div></article>)}</div>
    {teamMembers.length === 0 && <p className="py-12 text-center text-sm text-white/28">No team members yet.</p>}
    {draft && <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/85 p-5 backdrop-blur-md" role="dialog" aria-modal="true"><div className="mx-auto my-5 max-w-5xl rounded-2xl border border-white/10 bg-[#151515] p-6 sm:p-8"><div className="flex justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Team profile</p><h2 className="mt-2 text-2xl font-light text-white">{draft.id ? "Edit team member" : "New team member"}</h2></div><button onClick={() => setDraft(null)} className="admin-btn-icon-sm">×</button></div><div className="mt-7 grid gap-7 lg:grid-cols-[18rem_minmax(0,1fr)]"><div><div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-black/25">{draft.portraitUrl ? <Image src={draft.portraitUrl} alt="Portrait preview" fill unoptimized sizes="18rem" className="object-cover grayscale" style={{ objectPosition: `${draft.focalX * 100}% ${draft.focalY * 100}%` }} /> : <div className="flex h-full items-center justify-center text-sm text-white/20">Portrait</div>}</div><label className="mt-3 admin-btn-secondary cursor-pointer">Choose portrait<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setPortraitFile(file); setDraft({ ...draft, portraitUrl: URL.createObjectURL(file), portraitAlt: draft.portraitAlt || draft.name }); } }} /></label><button type="button" onClick={() => setDraft({ ...draft, portraitStorageKey: null, portraitUrl: null })} className="mt-2 w-full admin-btn-link-destructive">Remove portrait</button><label className="mt-5 block text-[0.52rem] uppercase tracking-[0.14em] text-white/30">Horizontal focus<input type="range" min="0" max="1" step="0.01" value={draft.focalX} onChange={(e) => setDraft({ ...draft, focalX: Number(e.target.value) })} className="mt-2 w-full accent-[var(--helios-orange)]" /></label><label className="mt-3 block text-[0.52rem] uppercase tracking-[0.14em] text-white/30">Vertical focus<input type="range" min="0" max="1" step="0.01" value={draft.focalY} onChange={(e) => setDraft({ ...draft, focalY: Number(e.target.value) })} className="mt-2 w-full accent-[var(--helios-orange)]" /></label></div><div className="grid content-start gap-4 sm:grid-cols-2"><Input label="Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value, portraitAlt: draft.portraitAlt || value })} /><Input label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} /><label className="block text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/30">Category<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as TeamMemberCategory })} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white">{teamMemberCategories.map((cat) => <option key={cat} value={cat}>{teamMemberCategoryLabels[cat]}</option>)}</select></label><Input label="Portrait alt" value={draft.portraitAlt ?? ""} onChange={(value) => setDraft({ ...draft, portraitAlt: value })} /><div className="sm:col-span-2"><Textarea label="Biography" value={draft.biography} onChange={(value) => setDraft({ ...draft, biography: value })} rows={7} /></div><label className="flex items-center gap-3 text-sm text-white/45"><input type="checkbox" checked={draft.visible} onChange={(event) => setDraft({ ...draft, visible: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]" />Visible on public About page</label></div></div><div className="mt-8 flex justify-end gap-3 border-t border-white/[0.08] pt-6"><button onClick={() => setDraft(null)} className="admin-btn-secondary">Cancel</button><button onClick={saveTeam} disabled={teamBusy !== null || !draft.name.trim() || !draft.title.trim() || !draft.biography.trim()} className="admin-btn-primary">{teamBusy ? "Saving…" : "Save team member"}</button></div></div></div>}
  </Panel>;
}
