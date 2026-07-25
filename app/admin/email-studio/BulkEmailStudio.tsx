"use client";

import { useMemo, useState } from "react";

type Client = { id: string; displayName: string; email: string; groupIds: string[] };
type Group = { id: string; name: string; count: number };
type Campaign = { id: string; subject: string; status: string; recipientCount: number; sentCount: number; failedCount: number; createdAt: string; sentAt: string | null; createdBy: { displayName: string } };
type Mode = "ALL" | "GROUPS" | "INDIVIDUALS";

export default function BulkEmailStudio({ clients, groups, campaigns, canSend, defaultTestEmail }: { clients: Client[]; groups: Group[]; campaigns: Campaign[]; canSend: boolean; defaultTestEmail: string }) {
  const [mode, setMode] = useState<Mode>("ALL");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [body, setBody] = useState("");
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [history, setHistory] = useState(campaigns);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? clients.filter((client) => `${client.displayName} ${client.email}`.toLowerCase().includes(query)) : clients;
  }, [clients, search]);
  const recipientCount = useMemo(() => {
    if (mode === "ALL") return clients.length;
    if (mode === "INDIVIDUALS") return clients.filter((client) => clientIds.includes(client.id)).length;
    return clients.filter((client) => client.groupIds.some((groupId) => groupIds.includes(groupId))).length;
  }, [clients, clientIds, groupIds, mode]);

  function toggle(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function submit(action: "test" | "send") {
    if (action === "send" && !window.confirm(`Send this campaign to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}? This action cannot be undone.`)) return;
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/email-campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subject, previewText, body, mode, groupIds, clientIds, testEmail }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The request could not be completed.");
      setMessage({ tone: "ok", text: data.message });
      if (action === "send") {
        setHistory((current) => [{ id: data.campaignId, subject, status: data.failed ? "PARTIAL" : "SENT", recipientCount, sentCount: data.sent, failedCount: data.failed, createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), createdBy: { displayName: "You" } }, ...current]);
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The request could not be completed." });
    } finally {
      setBusy(null);
    }
  }

  return <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,.8fr)]">
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-white/30">01 · Audience</p><h2 className="mt-2 text-2xl font-light text-white">Choose recipients</h2></div><p className="rounded-full border border-[#e7ddc8]/20 bg-[#e7ddc8]/[0.07] px-4 py-2 text-sm text-[#e7ddc8]">{recipientCount} eligible</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{(["ALL", "GROUPS", "INDIVIDUALS"] as Mode[]).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${mode === value ? "border-[#e7ddc8]/35 bg-[#e7ddc8]/10 text-[#f3ead8]" : "border-white/[0.08] text-white/40 hover:border-white/15"}`}>{value === "ALL" ? "All clients" : value === "GROUPS" ? "Groups" : "Individuals"}</button>)}</div>
        {mode === "GROUPS" && <div className="mt-5 grid gap-2 sm:grid-cols-2">{groups.map((group) => <label key={group.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] px-4 py-3 text-sm text-white/55"><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => toggle(group.id, groupIds, setGroupIds)} /><span className="flex-1">{group.name}</span><span className="text-xs text-white/25">{group.count}</span></label>)}{!groups.length && <p className="text-sm text-white/35">Create a client group first.</p>}</div>}
        {mode === "INDIVIDUALS" && <div className="mt-5"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients…" className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/25" /><div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-white/[0.07]">{filteredClients.map((client) => <label key={client.id} className="flex cursor-pointer items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-0"><input type="checkbox" checked={clientIds.includes(client.id)} onChange={() => toggle(client.id, clientIds, setClientIds)} /><span className="min-w-0"><span className="block truncate text-sm text-white/65">{client.displayName}</span><span className="block truncate text-xs text-white/30">{client.email}</span></span></label>)}</div></div>}
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-white/30">02 · Message</p><h2 className="mt-2 text-2xl font-light text-white">Compose email</h2>
        <div className="mt-5 space-y-4"><label className="block text-xs text-white/35">Subject<input value={subject} maxLength={160} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label><label className="block text-xs text-white/35">Preview text <span className="text-white/20">(optional)</span><input value={previewText} maxLength={180} onChange={(event) => setPreviewText(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label><label className="block text-xs text-white/35">Message<textarea value={body} maxLength={20000} onChange={(event) => setBody(event.target.value)} rows={12} placeholder={"Write your message here.\n\nUse a blank line to begin a new paragraph."} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-7 text-white placeholder:text-white/20" /></label></div>
      </section>
      {message && <p role="status" className={`rounded-xl border px-5 py-4 text-sm ${message.tone === "ok" ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80" : "border-red-400/20 bg-red-400/[0.06] text-red-200/80"}`}>{message.text}</p>}
      <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:flex-row sm:items-end"><label className="flex-1 text-xs text-white/35">Test recipient<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label><button type="button" disabled={!canSend || busy !== null || !subject.trim() || !body.trim()} onClick={() => submit("test")} className="admin-btn-secondary">{busy === "test" ? "Sending test…" : "Send test"}</button><button type="button" disabled={!canSend || busy !== null || !subject.trim() || !body.trim() || recipientCount === 0} onClick={() => submit("send")} className="admin-btn-primary">{busy === "send" ? "Sending…" : `Send to ${recipientCount}`}</button></section>
      {!canSend && <p className="text-xs text-amber-200/65">Owner or administrator access is required to test or send campaigns.</p>}
    </div>
    <aside className="space-y-6">
      <section className="sticky top-6 rounded-2xl border border-white/[0.08] bg-[#111] p-6"><p className="text-xs uppercase tracking-[0.16em] text-white/30">Live preview</p><div className="mt-5 bg-[#0b0b0b] p-5"><p className="text-[10px] uppercase tracking-[0.18em] text-[var(--helios-orange)]">Helios Real Estate Media</p><h3 className="mt-5 text-xl font-light text-white">{subject || "Your email subject"}</h3>{previewText && <p className="mt-2 text-xs text-white/30">{previewText}</p>}<div className="mt-5 whitespace-pre-wrap border border-white/[0.08] bg-[#121211] p-5 text-sm leading-7 text-white/60">{body || "Your message preview will appear here."}</div><p className="mt-4 text-[10px] leading-4 text-white/25">An unsubscribe link is automatically included.</p></div></section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6"><p className="text-xs uppercase tracking-[0.16em] text-white/30">Campaign history</p><div className="mt-4 divide-y divide-white/[0.06]">{history.map((campaign) => <article key={campaign.id} className="py-4 first:pt-0"><div className="flex items-start justify-between gap-3"><p className="text-sm text-white/65">{campaign.subject}</p><span className="text-[10px] uppercase tracking-[0.12em] text-white/30">{campaign.status}</span></div><p className="mt-2 text-xs text-white/25">{campaign.sentCount}/{campaign.recipientCount} sent{campaign.failedCount ? ` · ${campaign.failedCount} failed` : ""} · {new Date(campaign.createdAt).toLocaleDateString()}</p></article>)}{!history.length && <p className="py-6 text-sm text-white/30">No campaigns sent yet.</p>}</div></section>
    </aside>
  </div>;
}
