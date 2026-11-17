"use client";
import { useState } from "react";
import { parseCopyPackage } from "@/lib/project-copy-package";
import { PROJECT_WRITING_REQUEST_EVENT, videoCopyFields, type WritingCopyRequest } from "@/lib/project-video-copy";
type Fields = ReturnType<typeof videoCopyFields>;
export default function VideoCopyButton({ projectId, disabled, onApply }: { projectId: string; disabled?: boolean; onApply: (fields: Fields) => void }) {
  const [pending, setPending] = useState<Fields | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function preview() {
    setBusy(true); setPending(null); setMessage("");
    try {
      const request: WritingCopyRequest = { projectId, draft: null };
      window.dispatchEvent(new CustomEvent(PROJECT_WRITING_REQUEST_EVENT, { detail: request }));
      let draft = request.draft;
      if (!draft) {
        const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/copy-package`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Saved copy could not be loaded.");
        if (result.package) draft = parseCopyPackage(result.package).draft;
      }
      if (!draft) throw Error("Generate copy in the AI writing helper first, or save a copy package for this project.");
      const fields = videoCopyFields(draft);
      if (!Object.values(fields).some(value => value.trim())) throw Error("The AI copy has no video display title, accessibility description or caption yet. Add those in the writing helper first.");
      setPending(fields);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Copy could not be loaded. Your fields are unchanged."); }
    finally { setBusy(false); }
  }
  return <div className="mb-5 space-y-3 rounded-xl border border-white/10 p-4">
    <button type="button" className="admin-btn-secondary" disabled={disabled || busy} onClick={() => void preview()}>{busy ? "Loading copy…" : "Use AI writer copy…"}</button>
    <p className="text-xs text-white/50">Uses your current edited video display title, accessibility description and caption, or saved project copy if the helper is empty. YouTube publishing title and description stay separate.</p>
    {pending && <div className="space-y-3 text-sm text-white/70"><p>Review before replacing these fields, including unsaved text. Blank suggestions leave existing text unchanged.</p>{([["title", "Display title"], ["altText", "Accessibility description"], ["caption", "Caption"]] as const).map(([key,label]) => pending[key].trim() ? <div key={key}><strong>{label}</strong><p className="whitespace-pre-wrap">{pending[key]}</p></div> : null)}<div className="flex flex-wrap gap-3"><button type="button" className="admin-btn-secondary" onClick={() => setPending(null)}>Cancel</button><button type="button" className="admin-btn-secondary" disabled={disabled} onClick={() => { onApply(pending); setPending(null); setMessage("Video fields filled. Review and add the video when ready. Nothing has been saved or published."); }}>Confirm fill video fields</button></div></div>}
    {message && <p role="status" className="text-sm text-white/65">{message}</p>}
  </div>;
}
