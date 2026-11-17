"use client";

import { projectWritingApplications } from "@/lib/project-writing-apply";

import ProjectCopyPackageControls from "./ProjectCopyPackageControls";

import AdminCardHeading from "@/app/admin/components/AdminCardHeading";

import { useEffect, useRef, useState } from "react";
import { PROJECT_WRITING_APPLY_EVENT, PROJECT_WRITING_SOURCE_LIMIT, parseProjectWritingDraft, projectWritingFields, type ProjectWritingApplication, type ProjectWritingApplyField, type ProjectWritingDraft, type ProjectWritingTarget } from "@/lib/project-writing";

type Props = {
  projectId?: string;
  onApply?: (application: ProjectWritingApplication) => void;
  /** Disable application for a read-only surface; copyable suggestions remain available. */
  allowApply?: boolean;
  projectFieldsOnly?: boolean;
  handoffKey?: string;
};
export default function ProjectWritingAssistant({ projectId, onApply, allowApply = true, projectFieldsOnly = false, handoffKey }: Props) {
  const [source, setSource] = useState("");
  const [draft, setDraft] = useState<ProjectWritingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingAll, setPendingAll] = useState<ProjectWritingApplication[] | null>(null);
  const [replaceSuggestions, setReplaceSuggestions] = useState(false);
  const [videoTarget, setVideoTarget] = useState<ProjectWritingTarget>("project");
  const [pending, setPending] = useState<ProjectWritingApplication | null>(null);
  const busyRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const outputs = useRef<Partial<Record<keyof ProjectWritingDraft, HTMLTextAreaElement | null>>>({});
  useEffect(() => () => controller.current?.abort(), []);
  // One-time, tab-local transfer from New Project. No source text goes in the URL
  // or database, and loading suggestions never applies them to project fields.
  useEffect(() => {
    if (!projectId) return;
    const url = new URL(window.location.href);
    const key = url.searchParams.get("writingHandoff");
    if (!key || key.length > 200) return;
    try {
      const storageKey = `helios:project-writing:${key}`;
      const stored = sessionStorage.getItem(storageKey);
      sessionStorage.removeItem(storageKey);
      url.searchParams.delete("writingHandoff");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      if (!stored) return;
      const payload = JSON.parse(stored);
      if (typeof payload.source !== "string" || payload.source.length > PROJECT_WRITING_SOURCE_LIMIT || !Number.isFinite(payload.createdAt) || Date.now() - payload.createdAt > 3600000) return;
      // Restore an external browser-storage snapshot after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSource(payload.source);
      if (payload.draft) setDraft(parseProjectWritingDraft(payload.draft));
      setMessage("Your description and suggestions are ready to continue. Nothing has been applied automatically.");
    } catch { /* Storage unavailable or expired: manual writing still works. */ }
  }, [projectId]);
  useEffect(() => {
    if (!handoffKey) return;
    try { sessionStorage.setItem(`helios:project-writing:${handoffKey}`, JSON.stringify({ source, draft, createdAt: Date.now() })); }
    catch { /* Private browsing may disable storage; keep the current form usable. */ }
  }, [handoffKey, source, draft]);


  async function generate() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setMessage("Preparing suggestions…"); setPending(null); setPendingAll(null); setReplaceSuggestions(false);
    const requestController = new AbortController(); controller.current = requestController;
    try {
      const response = await fetch("/api/admin/projects/writing-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, ...(projectId ? { projectId } : {}) }), signal: requestController.signal });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to generate suggestions.");
      setDraft(parseProjectWritingDraft(result.draft));
      setMessage("Suggestions ready. Review facts and edit below before saving or applying.");
    } catch (error) {
      if (!requestController.signal.aborted) setMessage(error instanceof Error ? error.message : "Unable to generate suggestions. Your existing copy is unchanged.");
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function copy(key: keyof ProjectWritingDraft) {
    if (!draft) return;
    try { await navigator.clipboard.writeText(draft[key]); setMessage(`${projectWritingFields.find(field => field.key === key)?.label} copied.`); }
    catch { outputs.current[key]?.focus(); outputs.current[key]?.select(); setMessage("Clipboard unavailable. The text is selected so you can copy it manually."); }
  }
  function applyAll() {
    if (!pendingAll || busy || !allowApply) return;
    for (const application of pendingAll) {
      if (onApply) onApply(application);
      else window.dispatchEvent(new CustomEvent<ProjectWritingApplication>(PROJECT_WRITING_APPLY_EVENT, { detail: application }));
    }
    setPendingAll(null);
    setMessage("Applicable suggestions applied to the editor fields only. Save project details and save/add video separately when ready. YouTube fields remain copy-only.");
  }
  function apply() {
    if (!pending) return;
    if (onApply) onApply(pending);
    else window.dispatchEvent(new CustomEvent<ProjectWritingApplication>(PROJECT_WRITING_APPLY_EVENT, { detail: pending }));
    setPending(null); setPendingAll(null);
    setMessage("Suggestion applied to the editor only. Review the field and use its Save button when ready.");
  }
  const fieldClass = "mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]/70";
  return (
    <details className="group/writing rounded-2xl border border-white/10 bg-[#111]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)] [&::-webkit-details-marker]:hidden"><span className="min-w-0 flex-1"><AdminCardHeading inline eyebrow="Project copy" title="AI writing helper" description="Paste the agent’s description once to draft project and video copy. Review each suggestion before applying it; nothing saves or publishes automatically." /></span><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl font-light text-white/70"><span className="group-open/writing:hidden">+</span><span className="hidden group-open/writing:inline">−</span></span></summary>
      <div className="space-y-5 border-t border-white/10 p-5">
        {projectId ? <ProjectCopyPackageControls projectId={projectId} source={source} draft={draft} onRestore={value => { setSource(value.source); setDraft(value.draft); setPending(null); setPendingAll(null); }} /> : <p className="text-xs text-white/55">Create the draft first to save the full copy package privately with the project. Your suggestions carry into the new draft in this tab.</p>}
        <label className="block"><span className="block text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]">Agent property description</span>
          <textarea value={source} onChange={event => setSource(event.target.value)} disabled={busy} rows={6} maxLength={PROJECT_WRITING_SOURCE_LIMIT} className={fieldClass} />
          <span className="mt-1 block text-xs text-white/45">{source.length.toLocaleString()} / 12,000 characters. Use at least 20 characters.</span>
        </label>
        <p className="text-xs leading-5 text-white/55">Generate sends your description to OpenAI. Remove private contact details, access codes, and anything you do not want shared.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || source.trim().length < 20} onClick={() => draft ? setReplaceSuggestions(true) : void generate()} className="admin-btn-secondary">{busy ? "Generating…" : draft ? "Generate new suggestions" : "Generate suggestions"}</button>
          {busy ? <button type="button" className="admin-btn-link" onClick={() => { controller.current?.abort(); setMessage("Generation cancelled. Existing suggestions and project fields are unchanged."); }}>Cancel</button> : null}
        </div>
        {replaceSuggestions ? <div className="rounded-xl border border-amber-200/20 p-4 text-sm text-white/70"><p>Replace the suggestions below, including your edits to them? Project and video editor fields will not change.</p><div className="mt-3 flex gap-3"><button type="button" className="admin-btn-secondary" onClick={() => setReplaceSuggestions(false)}>Keep suggestions</button><button type="button" className="admin-btn-primary" onClick={() => void generate()}>Replace suggestions</button></div></div> : null}
        {message ? <p role="status" className="text-sm text-white/65">{message}</p> : null}
        {draft ? <>
          <p className="text-xs leading-5 text-amber-100/70">Verify all details before use. Accessibility copy is based on the pasted description, not an analysis of the video. Review it against the actual footage. No thumbnails or media are generated.</p>
          {allowApply && !projectFieldsOnly ? <label className="block max-w-sm text-sm text-white/65">Apply video suggestions to
            <select value={videoTarget} onChange={event => { setVideoTarget(event.target.value as ProjectWritingTarget); setPending(null); setPendingAll(null); }} className={fieldClass}><option value="project">Project fields only · choose a video form to include video copy</option><option value="hosted-video">New hosted video link form</option><option value="upload-video">Direct video upload form</option></select>
          </label> : null}
          <div className="grid gap-5 lg:grid-cols-2">
            {projectWritingFields.map(({ key, label, max }) => <div key={key} className="rounded-xl border border-white/10 p-4">
              <label className="block text-sm text-white/75">{label}<textarea ref={element => { outputs.current[key] = element; }} value={draft[key]} maxLength={max} rows={key === "description" || key === "youtubeDescription" ? 6 : 3} onChange={event => { setDraft(current => current ? { ...current, [key]: event.target.value } : current); setPending(null); setPendingAll(null); }} className={fieldClass} /></label>
              <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => void copy(key)} className="admin-btn-secondary" aria-label={`Copy ${label}`}>Copy</button>
                {allowApply && !key.startsWith("youtube") && !(projectFieldsOnly && key.startsWith("video")) ? <button type="button" disabled={busy || !draft[key].trim() || (key.startsWith("video") && videoTarget === "project")} onClick={() => { setPendingAll(null); setPending({ projectId, field: key as ProjectWritingApplyField, value: draft[key], target: key.startsWith("video") ? videoTarget : "project" }); }} className="admin-btn-secondary" aria-label={`Apply ${label}`}>Apply to editor…</button> : null}
              </div>
              {pending?.field === key ? <div className="mt-3 rounded-lg border border-amber-200/20 p-3 text-sm text-white/70"><p>Replace the current {label.toLowerCase()} in {pending.target === "project" ? "project details" : pending.target === "hosted-video" ? "the hosted video link form" : "the direct video upload form"}? This can replace unsaved text. It will not save or publish.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => setPending(null)} className="admin-btn-secondary">Cancel</button><button type="button" onClick={apply} className="admin-btn-primary">Confirm replacement</button></div></div> : null}
            </div>)}
          </div>
          {allowApply ? <>
            <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy || !projectWritingApplications(draft, projectId, projectFieldsOnly, videoTarget).length} onClick={() => { setPending(null); setPendingAll(projectWritingApplications(draft, projectId, projectFieldsOnly, videoTarget)); }} className="admin-btn-secondary">Apply All to Editor…</button><span className="text-xs text-white/45">Fills available editor fields with your edited suggestions. Blank and YouTube fields are excluded.</span></div>
            {pendingAll ? <div className="rounded-xl border border-amber-200/20 p-4 text-sm text-white/70"><p>Replace these editor fields, including any unsaved text?</p><ul className="mt-2 list-disc pl-5">{pendingAll.map(application => <li key={application.field}>{projectWritingFields.find(field => field.key === application.field)?.label} → {application.target === "project" ? "project details" : application.target === "hosted-video" ? "hosted video link form" : "direct video upload form"}</li>)}</ul><p className="mt-2">This fills editor fields only. It does not save, publish, add a video, or update existing media. YouTube metadata is saved with the private copy package and remains copy-only for YouTube. Blank suggestions leave existing fields unchanged.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => setPendingAll(null)} className="admin-btn-secondary">Cancel</button><button type="button" disabled={busy} onClick={applyAll} className="admin-btn-secondary">Confirm Apply All</button></div></div> : null}
          </> : null}
          <p className="text-xs text-white/45">YouTube title, description, and tags are retained when you save the copy package. Use Copy to transfer them to YouTube after review; they have no public project field.</p>
        </> : null}
      </div>
    </details>
  );
}
