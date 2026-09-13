"use client";

import { useEffect, useRef, useState } from "react";

export type AdminLegalDocument = {
  id: string;
  type: "PRIVACY_POLICY" | "TERMS_OF_SERVICE";
  title: string;
  content: string;
  published: boolean;
  updatedAt: string;
};

function confirmedDocument(value: unknown, submitted: AdminLegalDocument): AdminLegalDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const placeholder = submitted.type === "PRIVACY_POLICY" ? "legal-privacy-policy" : "legal-terms-of-service";
  const creating = submitted.id === placeholder && submitted.updatedAt === new Date(0).toISOString();
  if (typeof row.id !== "string" || !row.id || (creating && row.id === placeholder) || (!creating && row.id !== submitted.id)
    || row.type !== submitted.type || typeof row.title !== "string" || row.title !== submitted.title.trim() || !row.title || row.title.length > 160
    || typeof row.content !== "string" || row.content.length > 100000 || row.published !== submitted.published
    || (row.published && row.content.length < 100)
    || typeof row.updatedAt !== "string" || !Number.isFinite(Date.parse(row.updatedAt))
    || new Date(row.updatedAt).toISOString() !== row.updatedAt || Date.parse(row.updatedAt) <= Date.parse(submitted.updatedAt)) return null;
  return { id: row.id, type: submitted.type, title: row.title, content: row.content, published: row.published, updatedAt: row.updatedAt };
}

export default function LegalDocumentsManager({ initialDocuments }: { initialDocuments: AdminLegalDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [savedDocuments, setSavedDocuments] = useState(initialDocuments);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [copyPreserved, setCopyPreserved] = useState(false);
  const admission = useRef(false);
  const currentDocuments = useRef(initialDocuments);
  const preserved = useRef(false);
  const dirty = JSON.stringify(documents) !== JSON.stringify(savedDocuments);

  useEffect(() => {
    if (!dirty && !busy && !held) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy, held]);

  function update(type: AdminLegalDocument["type"], patch: Partial<AdminLegalDocument>) {
    if (admission.current) return;
    currentDocuments.current = currentDocuments.current.map((document) => document.type === type ? { ...document, ...patch } : document);
    setDocuments(currentDocuments.current);
    setMessage(null);
  }

  async function save(document: AdminLegalDocument) {
    if (admission.current || currentDocuments.current.find(row => row.type === document.type) !== document) return;
    if (!document.title.trim() || document.title.trim().length > 160 || document.content.trim().length > 100000) {
      setMessage("Enter a title and keep the legal document under 100,000 characters."); return;
    }
    if (document.published && document.content.trim().length < 100) {
      setMessage("Add the complete reviewed legal document before publishing it."); return;
    }
    admission.current = true;
    setBusy(document.type); setMessage(null);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        (async () => {
          const response = await fetch("/api/admin/legal-documents", {
            method: "PATCH", signal: controller.signal,
            headers: { "Content-Type": "application/json", "x-helios-legal-revision": "1" },
            body: JSON.stringify(document),
          });
          return { response, data: await response.json() };
        })(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error("UNCONFIRMED")); }, 30000); }),
      ]);
      const { response, data } = result;
      const saved = response.ok && data?.success === true && data.revisionProtocol === 1 ? confirmedDocument(data.document, document) : null;
      if (!saved) throw new Error("UNCONFIRMED");
      currentDocuments.current = currentDocuments.current.map(row => row.type === saved.type ? saved : row);
      setDocuments(currentDocuments.current);
      setSavedDocuments(current => current.map(row => row.type === saved.type ? saved : row));
      setMessage(`${saved.title} saved${saved.published ? " and published" : " as a draft"}.`);
      admission.current = false;
    } catch {
      // A failed acknowledgement may follow a committed write. Never retry it.
      setHeld(true);
      setMessage("Save not confirmed. Your edits are retained below. Preserve both documents, then reload saved documents and compare before saving again. Do not assume publication succeeded or failed.");
    } finally { clearTimeout(timeout); setBusy(null); }
  }

  return <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111]">
    <div className="border-b border-white/[0.08] p-6 lg:p-8"><p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Legal publishing</p><h2 className="mt-3 text-2xl font-light text-white">Privacy and terms</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Paste reviewed legal HTML, save it as a draft, and publish when approved. Published documents automatically appear in the footer. Supported formatting includes headings, paragraphs, bold and italic text, links, lists, blockquotes, sections, dividers, and tables. Scripts, embeds, inline styles, event handlers, and unsafe links are removed automatically.</p></div>
    <div className="grid gap-px bg-white/[0.06] xl:grid-cols-2">{documents.map((document) => <article key={document.type} className="bg-[#111] p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[0.53rem] font-semibold uppercase tracking-[0.15em] text-white/30">{document.type === "PRIVACY_POLICY" ? "/privacy" : "/terms"}</p><p className="mt-2 text-xs text-white/20">{new Date(document.updatedAt).getTime() > 0 ? `Updated ${new Date(document.updatedAt).toLocaleDateString()}` : "Not yet saved"}</p></div><span className={`rounded-full border px-3 py-1 text-[0.5rem] uppercase tracking-[0.13em] ${savedDocuments.find(row => row.type === document.type)?.published ? "border-emerald-300/15 text-emerald-200/55" : "border-white/10 text-white/25"}`}>{savedDocuments.find(row => row.type === document.type)?.published ? "Saved: published" : "Saved: draft"}</span></div>
      <label className="mt-6 block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Page title<input disabled={busy !== null || held} value={document.title} maxLength={160} onChange={(event) => update(document.type, { title: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
      <label className="mt-5 block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Document body · HTML<textarea readOnly={held} disabled={busy !== null} value={document.content} maxLength={100000} rows={18} onChange={(event) => update(document.type, { content: event.target.value })} placeholder="Paste reviewed legal HTML here…" spellCheck={false} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 font-mono text-xs normal-case leading-6 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
      <div className="mt-5 flex flex-wrap items-center gap-4"><label className="flex items-center gap-3 text-sm text-white/45"><input disabled={busy !== null || held} type="checkbox" checked={document.published} onChange={(event) => update(document.type, { published: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]" />Publish in footer</label><span className="text-xs text-white/20">{document.content.length.toLocaleString()} characters</span><button type="button" disabled={busy !== null || held} onClick={() => void save(document)} className="ml-auto admin-btn-primary">{busy === document.type ? "Saving…" : "Save document"}</button></div>
    </article>)}</div>
    {message ? <p role={held ? "alert" : "status"} className="border-t border-white/[0.08] px-6 py-4 text-sm text-white/40">{message}</p> : null}
    {held ? <div className="border-t border-white/10 p-6">
      <label className="block text-sm text-white/60">Select and copy this recovery snapshot before reloading. It contains both documents, including unsaved edits.
        <textarea aria-label="Unsaved legal documents" readOnly value={JSON.stringify(documents, null, 2)} rows={10} onFocus={event => event.target.select()} className="mt-3 w-full rounded-xl bg-black/30 p-3 font-mono text-xs" />
      </label>
      <label className="mt-4 flex gap-3 text-sm text-white/60"><input aria-label="I have preserved my unsaved copy" type="checkbox" checked={copyPreserved} onChange={event => { preserved.current = event.target.checked; setCopyPreserved(event.target.checked); }} />I have preserved my unsaved copy</label>
      <button type="button" disabled={!copyPreserved} onClick={() => { if (preserved.current) window.location.reload(); }} className="admin-btn-primary mt-4">Reload saved documents</button>
    </div> : null}
  </section>;
}
