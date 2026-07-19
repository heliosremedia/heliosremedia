"use client";

import { useState } from "react";

export type AdminLegalDocument = {
  id: string;
  type: "PRIVACY_POLICY" | "TERMS_OF_SERVICE";
  title: string;
  content: string;
  published: boolean;
  updatedAt: string;
};

export default function LegalDocumentsManager({ initialDocuments }: { initialDocuments: AdminLegalDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function update(type: AdminLegalDocument["type"], patch: Partial<AdminLegalDocument>) {
    setDocuments((current) => current.map((document) => document.type === type ? { ...document, ...patch } : document));
  }

  async function save(document: AdminLegalDocument) {
    setBusy(document.type); setMessage(null);
    try {
      const response = await fetch("/api/admin/legal-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(document),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save this document.");
      update(document.type, { ...data.document, updatedAt: data.document.updatedAt });
      setMessage(`${document.title} saved${document.published ? " and published" : " as a draft"}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save this document."); }
    finally { setBusy(null); }
  }

  return <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111]">
    <div className="border-b border-white/[0.08] p-6 lg:p-8"><p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Legal publishing</p><h2 className="mt-3 text-2xl font-light text-white">Privacy and terms</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Paste reviewed legal language, save it as a draft, and publish when approved. Published documents automatically appear in the footer. Use blank lines between paragraphs, <code className="text-white/60">##</code> for section headings, and <code className="text-white/60">-</code> for bullet lists.</p></div>
    <div className="grid gap-px bg-white/[0.06] xl:grid-cols-2">{documents.map((document) => <article key={document.type} className="bg-[#111] p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[0.53rem] font-semibold uppercase tracking-[0.15em] text-white/30">{document.type === "PRIVACY_POLICY" ? "/privacy" : "/terms"}</p><p className="mt-2 text-xs text-white/20">{new Date(document.updatedAt).getTime() > 0 ? `Updated ${new Date(document.updatedAt).toLocaleDateString()}` : "Not yet saved"}</p></div><span className={`rounded-full border px-3 py-1 text-[0.5rem] uppercase tracking-[0.13em] ${document.published ? "border-emerald-300/15 text-emerald-200/55" : "border-white/10 text-white/25"}`}>{document.published ? "Published" : "Draft"}</span></div>
      <label className="mt-6 block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Page title<input value={document.title} maxLength={160} onChange={(event) => update(document.type, { title: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
      <label className="mt-5 block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Document body<textarea value={document.content} maxLength={100000} rows={18} onChange={(event) => update(document.type, { content: event.target.value })} placeholder="Paste reviewed legal language here…" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 font-mono text-xs normal-case leading-6 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
      <div className="mt-5 flex flex-wrap items-center gap-4"><label className="flex items-center gap-3 text-sm text-white/45"><input type="checkbox" checked={document.published} onChange={(event) => update(document.type, { published: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]" />Publish in footer</label><span className="text-xs text-white/20">{document.content.length.toLocaleString()} characters</span><button type="button" disabled={busy !== null} onClick={() => void save(document)} className="ml-auto rounded-full bg-[var(--helios-orange)] px-6 py-3 text-[0.53rem] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-40">{busy === document.type ? "Saving…" : "Save document"}</button></div>
    </article>)}</div>
    {message ? <p role="status" className="border-t border-white/[0.08] px-6 py-4 text-sm text-white/40">{message}</p> : null}
  </section>;
}
