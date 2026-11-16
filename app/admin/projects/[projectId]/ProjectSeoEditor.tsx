"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProjectSeoEditor({ projectId, initialTitle, initialDescription, projectTitle, projectSummary }: { projectId: string; initialTitle: string; initialDescription: string; projectTitle: string; projectSummary: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState({ seoTitle: initialTitle, seoDescription: initialDescription });
  const [saved, setSaved] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = draft.seoTitle !== saved.seoTitle || draft.seoDescription !== saved.seoDescription;
  async function save() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/seo`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "SEO settings could not be saved.");
      setSaved(draft); setMessage("SEO settings saved."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "SEO settings could not be saved."); }
    finally { setBusy(false); }
  }
  const fieldClass = "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-[var(--helios-orange)]";
  return <section className="mt-6 space-y-4 rounded-xl border border-white/10 p-5">
    <h3 className="text-lg text-white">Search and sharing</h3>
    <p className="text-sm text-white/45">Optional. Empty fields use the project title and short description. Your link preview image is selected in Media.</p>
    <label className="block text-sm text-white/60">SEO title
      <input value={draft.seoTitle} onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })} maxLength={70} placeholder={projectTitle} className={fieldClass} />
      <span className="mt-1 block text-xs text-white/40">{draft.seoTitle.length}/70 characters</span>
    </label>
    <label className="block text-sm text-white/60">SEO description
      <textarea value={draft.seoDescription} onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })} maxLength={180} rows={3} placeholder={projectSummary || "A concise search and social description."} className={fieldClass} />
      <span className="mt-1 block text-xs text-white/40">{draft.seoDescription.length}/180 characters</span>
    </label>
    <div className="flex flex-wrap items-center gap-4"><button type="button" disabled={busy || !dirty} onClick={() => void save()} className="admin-btn-primary">{busy ? "Saving…" : "Save SEO"}</button><span className="text-xs text-white/45">{dirty ? "Unsaved SEO changes" : "Saved settings"}</span></div>
    {message ? <p role="status" className="text-sm text-white/60">{message}</p> : null}
  </section>;
}
