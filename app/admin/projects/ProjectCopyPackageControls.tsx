"use client";

import { useEffect, useRef, useState } from "react";
import { parseCopyPackage } from "@/lib/project-copy-package";
import { projectWritingFields, type ProjectWritingDraft } from "@/lib/project-writing";

type CopyPackage = { source: string; draft: ProjectWritingDraft };
type Saved = { revision: number; package: CopyPackage | null };
export default function ProjectCopyPackageControls({ projectId, source, draft, onRestore }: {
  projectId: string; source: string; draft: ProjectWritingDraft | null; onRestore: (value: CopyPackage) => void;
}) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [incoming, setIncoming] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const current = useRef({ source, draft, onRestore });
  useEffect(() => { current.current = { source, draft, onRestore }; }, [source, draft, onRestore]);
  const dirty = Boolean(draft) && (!saved?.package || JSON.stringify(saved.package) !== JSON.stringify({ source, draft }));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    async function loadInitial() {
      try {
        const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/copy-package`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Saved copy could not be loaded.");
        const value: Saved = { revision: result.revision, package: result.package ? parseCopyPackage(result.package) : null };
        if (controller.signal.aborted) return;
        setSaved(value);
        // Never replace handoff text, generation, or local typing that happened during the request.
        if (value.package && !current.current.source && !current.current.draft) current.current.onRestore(value.package);
      } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Saved copy could not be loaded."); }
    }
    void loadInitial();
    return () => controller.abort();
  }, [projectId]);
  async function save() {
    if (busy || !draft || !saved) return;
    const snapshot = { source, draft };
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/copy-package`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, revision: saved.revision }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Copy could not be saved.");
      setSaved({ revision: result.revision, package: snapshot });
      setMessage("Full copy package saved privately to this project, including YouTube metadata and video copy. Project details and media are unchanged.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Copy could not be saved. Local edits remain here."); }
    finally { setBusy(false); }
  }
  async function loadSaved() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/copy-package`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Saved copy could not be loaded.");
      const value: Saved = { revision: result.revision, package: result.package ? parseCopyPackage(result.package) : null };
      if (!value.package) { setSaved(value); setMessage("No copy package has been saved yet. Your local edits are unchanged."); }
      else setIncoming(value);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Saved copy could not be loaded."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-white/10 p-4">
    <p className="text-sm text-white/65">Save the source and complete edited copy package privately with this project to revisit later. This does not apply, publish, or change project details or media.</p>
    <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void save()} disabled={busy || !draft || !saved || !dirty} className="admin-btn-secondary">{busy ? "Working…" : "Save copy package"}</button><button type="button" onClick={() => void loadSaved()} disabled={busy} className="admin-btn-secondary">Load saved copy…</button><span className="text-xs text-white/45">{!saved ? "Checking saved copy" : dirty ? "Unsaved copy changes" : saved.package ? "Copy package saved" : "No saved copy yet"}</span></div>
    {message ? <p role="status" className="text-sm text-white/65">{message}</p> : null}
    {incoming?.package ? <div className="space-y-3 rounded-lg border border-amber-200/20 p-4"><p className="text-sm text-white/70">Load this saved version? It replaces the source and suggestions shown here, including unsaved edits. It does not change project or media fields. Copy anything you want to keep before replacing.</p><details><summary className="cursor-pointer text-sm text-white/70">Preview saved copy</summary><label className="mt-3 block text-sm text-white/60">Saved source description<textarea readOnly rows={4} value={incoming.package.source} className="mt-2 w-full rounded border border-white/15 bg-black/20 p-3" /></label><label className="mt-3 block text-sm text-white/60">Saved package<textarea readOnly rows={12} value={projectWritingFields.map(({ key, label }) => `${label}\n${incoming.package!.draft[key]}`).join("\n\n")} className="mt-2 w-full rounded border border-white/15 bg-black/20 p-3" /></label></details><div className="flex flex-wrap gap-3"><button type="button" onClick={() => setIncoming(null)} className="admin-btn-secondary">Keep my edits</button><button type="button" onClick={() => { onRestore(incoming.package!); setSaved(incoming); setIncoming(null); setMessage("Saved copy loaded. Nothing has been applied to project or media fields."); }} className="admin-btn-secondary">Replace with saved copy</button></div></div> : null}
  </div>;
}
