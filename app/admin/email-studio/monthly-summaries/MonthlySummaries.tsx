"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
type Report = { id: string; recipientEmail: string; status: string; generatedAt: string; acceptedAt: string | null; client: { displayName: string } };
type Settings = { reviewMode: boolean; testEmail: string; connected: boolean; liveApproved: boolean; automationEnabled: boolean; sender: string };
type History = { id: string; kind: string; status: string; recipientEmail: string; createdAt: string; providerMessageId: string | null; error: string | null; attemptCount: number };
const labels: Record<string, string> = { CHECK_FAILED: "Account check failed", READY: "Ready", NEEDS_REVIEW: "Needs review", ACCEPTED: "Sent · accepted", UNCERTAIN: "Check delivery", SENDING: "Sending / check history", FAILED: "Failed", SUPPRESSED: "Suppressed", NO_PURCHASES: "No purchases" };
const timestamp = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Denver", dateStyle: "medium", timeStyle: "short" });
const button = "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35";
async function api(query = "", payload?: object) {
  const response = await fetch(`/api/admin/monthly-summaries${query}`, payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}
export default function MonthlySummaries({ initialMonth, isOwner }: { initialMonth: string; isOwner: boolean }) {
  const [month, setMonth] = useState(initialMonth);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PURCHASES");
  const [reports, setReports] = useState<Report[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState("");
  const [html, setHtml] = useState("");
  const [sample, setSample] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [reviewNotes, setReviewNotes] = useState<string[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const deliveryBusy = useRef(false);
  const [mobile, setMobile] = useState(false);
  const sequence = useRef(0);
  const generation = useRef<{month:string; cursor?:string; checked:number; generated:number; failed:number} | null>(null);
  const resendRequest = useRef<{ report: string; id: string } | null>(null);
  const testRequest = useRef<{ report: string; id: string } | null>(null);
  const refresh = useCallback(async () => {
    const result = await api(`?month=${month}`);
    setReports(result.reports); setSettings(result.settings);
  }, [month]);
  useEffect(() => {
    let active = true;
    setSearch(""); setStatusFilter("PURCHASES");
    setSelected(""); setHtml(""); setHistory([]); setIssues([]); setReviewNotes([]); setReports([]); setError(""); setMessage("");
    sequence.current++; generation.current = null;
    api(`?month=${month}`).then(result => { if (active) { setReports(result.reports); setSettings(result.settings); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [month]);
  async function preview(id: string) {
    const current = ++sequence.current;
    setBusy(true); setError(""); setHtml(""); setIssues([]); setReviewNotes([]); setHistory([]); setSelected(id); setSample(!id);
    try {
      const result = await api(`?month=${month}&${id ? `reportId=${encodeURIComponent(id)}` : "sample=true"}`);
      if (current !== sequence.current) return;
      setHtml(result.html || ""); setIssues(result.summary?.issues || []); setReviewNotes(result.summary?.reviewNotes || []); setHistory(result.history || []);
    } catch (e) { if (current === sequence.current) setError(e instanceof Error ? e.message : "Preview failed."); }
    finally { if (current === sequence.current) setBusy(false); }
  }
  async function action(payload: { action: string; [key: string]: unknown }) {
    setBusy(true); setError(""); setMessage("");
    try {
      if (payload.action === "generate" && settings?.reviewMode) {
        testRequest.current = null;
        const progress = generation.current?.month === month ? generation.current : { month, checked:0, generated:0, failed:0 };
        generation.current = progress;
        setMessage("Checking accounts in paced batches. Keep this tab open; the full month may take several minutes.");
        while (true) {
          const result = await api("", { ...payload, afterClientId:progress.cursor });
          progress.checked += result.checked; progress.generated += result.generated; progress.failed += result.checkFailed;
          progress.cursor = result.nextCursor || undefined;
          setMessage(`${progress.checked} accounts checked; ${progress.generated} purchase summaries; ${progress.failed} checks failed. ${result.nextCursor ? "Continuing next batch… Keep this tab open." : "Generation finished. No emails were sent."}`);
          await refresh();
          if (!result.nextCursor) { generation.current = null; break; }
        }
      } else {
        const result = await api("", payload);
        setMessage(result.message); await refresh();
      }
      if (payload.action === "resend") resendRequest.current = null;
      if (selected) await preview(selected);
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }
  async function sendMonth(resend: boolean) {
    if (deliveryBusy.current) return;
    const targets = reports.filter(r => resend ? r.status === "ACCEPTED" && r.acceptedAt : r.status === "READY" && !r.acceptedAt);
    if (!targets.length || !window.confirm(`${resend ? "Resend" : "Send"} ${targets.length} saved summaries for ${monthLabel}? Each client receives their own summary and PDF. Reports needing review are held. This covers the whole month, regardless of search filters.`)) return;
    deliveryBusy.current = true; setBusy(true); setError("");
    let accepted = 0;
    try {
      for (const report of targets) {
        setMessage(`${resend ? "Resending" : "Sending"} ${monthLabel}: ${accepted} of ${targets.length} accepted. Keep this tab open.`);
        await api("", { action: resend ? "resend" : "send", reportId: report.id, requestId: crypto.randomUUID(), confirmResend: resend, confirmSend: !resend });
        accepted++;
      }
      setMessage(`${monthLabel}: ${accepted} deliveries accepted by Resend. See each report's send history for details.`);
    } catch (e) {
      setMessage(`${accepted} deliveries accepted before the batch stopped.`);
      setError(`${e instanceof Error ? e.message : "Delivery could not be confirmed."} Review send history before starting another batch.`);
    } finally {
      try { await refresh(); } catch { setError("Refresh the page to check final delivery statuses."); }
      deliveryBusy.current = false; setBusy(false);
    }
  }
  async function downloadPdf() {
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ month, format: "pdf", ...(sample ? { sample: "true" } : { reportId: selected }) });
      const response = await fetch(`/api/admin/monthly-summaries?${query}`, { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "PDF could not be downloaded.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `Helios-Media-Summary-${month}${sample ? "-Sample" : ""}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) { setError(e instanceof Error ? e.message : "PDF download failed."); }
    finally { setBusy(false); }
  }
  const purchaseReports = reports.filter(r => !["NO_PURCHASES", "CHECK_FAILED"].includes(r.status));
  const visibleReports = reports.filter(report => {
    const matchesStatus = statusFilter === "PURCHASES"
      ? !["NO_PURCHASES", "CHECK_FAILED"].includes(report.status)
      : report.status === statusFilter;
    const query = search.trim().toLowerCase();
    return matchesStatus && (!query || report.client.displayName.toLowerCase().includes(query) || report.recipientEmail.toLowerCase().includes(query));
  });
  const monthLabel = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const counts = [
    ["Purchase summaries", reports.filter(r => !["NO_PURCHASES", "CHECK_FAILED"].includes(r.status)).length], ["Ready", reports.filter(r => r.status === "READY").length],
    ["Sent", reports.filter(r => r.status === "ACCEPTED").length], ["Needs review", reports.filter(r => ["NEEDS_REVIEW", "UNCERTAIN", "SENDING"].includes(r.status)).length], ["Checks failed", reports.filter(r => r.status === "CHECK_FAILED").length],
  ];
  return <div className="space-y-6">
    <Link href="/admin/email-studio" className="text-sm text-white/50 hover:text-white">← Email Studio</Link>
    <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><button type="button" aria-expanded={settingsOpen} aria-controls="delivery-settings-details" onClick={() => setSettingsOpen(!settingsOpen)} className="text-lg text-white">Delivery settings {settingsOpen ? "▴" : "▾"}</button></div><span className="rounded-full bg-amber-200/10 px-3 py-1.5 text-xs text-amber-100">{settings?.automationEnabled && settings.liveApproved ? "Automation enabled" : "Automation paused"}</span></div>
      <div id="delivery-settings-details" hidden={!settingsOpen}><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-white/40">HDPhotoHub</dt><dd className="mt-1 text-white/80">{settings?.connected ? "Connected" : "Connection needed"}</dd></div><div><dt className="text-white/40">Sender</dt><dd className="mt-1 break-words text-white/80">{settings?.sender || "Loading…"}</dd></div><div><dt className="text-white/40">Internal test recipient</dt><dd className="mt-1 break-words text-white/80">{settings?.testEmail || "Configured internal inbox"}</dd></div></dl>
      <p className="mt-4 text-xs leading-6 text-white/40">{settings?.liveApproved ? "Automation follows your saved preference. Existing unsubscribe and bounce protections apply." : "Review mode. Saved drafts and internal tests are available; automatic client sending remains paused."}</p>
      <div className="mt-3 flex flex-wrap gap-3"><button className={button} disabled={busy || !settings || (settings.reviewMode || (!settings.liveApproved && !settings.automationEnabled))} onClick={() => { if (!settings?.automationEnabled && !window.confirm("Enable monthly automation? The next scheduled run can send eligible reports for the previous calendar month, including October when enabled in November. Reports needing review remain held.")) return; action({ action: "settings", automationEnabled: !settings?.automationEnabled }); }}>{settings?.automationEnabled ? "Pause automation" : "Enable automation"}</button>
      {isOwner && <Link href="/admin/email-studio/monthly-summaries/verify" className="inline-block rounded-xl border border-white/15 px-4 py-3 text-sm text-white/80">Verify existing HDPhotoHub connection</Link>}
      </div></div>
    </section>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{counts.map(([label, count]) => <div key={label} className="rounded-xl border border-white/10 p-4"><p className="text-xs text-white/45">{label}</p><p className="mt-2 text-2xl font-light text-white">{count}</p></div>)}</div>
    <p className="text-sm text-white/50">Choose a month to view its saved purchase summaries. Search and filters apply only to that month; opening a month does not regenerate reports.</p>
    <div className="flex flex-wrap items-end gap-3"><label className="text-xs text-white/50">Reporting month<input aria-label="Reporting month" type="month" min="2020-01" max={initialMonth} value={month} disabled={busy} onChange={e => { if (e.target.value) setMonth(e.target.value); }} className="mt-2 block rounded-xl border border-white/15 bg-[#171717] px-3 py-2.5 text-sm text-white" /></label><button className={button} disabled={busy || !settings?.connected} onClick={() => action({ action: "generate", month })}>{busy ? "Working…" : generation.current ? "Resume generation" : "Generate / refresh month"}</button><button className={button} disabled={busy} onClick={() => preview("")}>View design sample</button></div>
    <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !settings?.liveApproved || !reports.some(r => r.status === "READY" && !r.acceptedAt)} onClick={() => sendMonth(false)}>Send month</button>{reports.some(r => r.acceptedAt) && <button className={button} disabled={busy || !settings?.liveApproved || !reports.some(r => r.status === "ACCEPTED")} onClick={() => sendMonth(true)}>Resend month</button>}</div>
    {message && <p role="status" className="rounded-xl bg-emerald-300/10 p-4 text-sm text-emerald-100">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-300/10 p-4 text-sm text-red-100">{error}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-white/10"><div className="space-y-3 border-b border-white/10 p-5"><h2 className="text-white">{monthLabel}</h2><p className="text-xs text-white/50">{purchaseReports.length} purchase summaries · {visibleReports.length} shown</p><input aria-label="Search monthly reports" type="search" placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-2 text-sm text-white" /><select aria-label="Filter monthly reports by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-2 text-sm text-white"><option value="PURCHASES">All purchase summaries</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{visibleReports.length ? <ul className="max-h-[760px] overflow-auto divide-y divide-white/10">{visibleReports.map(report => <li key={report.id}><button disabled={busy} onClick={() => preview(report.id)} className={`w-full p-5 text-left hover:bg-white/5 ${selected === report.id ? "bg-white/10" : ""}`}><span className="block text-sm text-white/90">{report.client.displayName}</span><span className="mt-1 block break-all text-xs text-white/40">{report.recipientEmail}</span><span className={`mt-3 inline-block rounded-full px-2 py-1 text-xs ${["READY", "ACCEPTED"].includes(report.status) ? "bg-emerald-300/10 text-emerald-100" : "bg-white/5 text-white/60"}`}>{labels[report.status] || report.status}</span><span className="mt-2 block text-[11px] text-white/35">Generated {timestamp(report.generatedAt)} MT</span></button></li>)}</ul> : <p className="p-5 text-sm leading-7 text-white/40">{purchaseReports.length || search || statusFilter !== "PURCHASES" ? "No reports match these filters." : "No purchase summaries saved for this month. Choose Generate / refresh month to create them."}</p>}</section>
      <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div><h2 className="text-white">{sample ? "Design sample" : "Email preview"}</h2><p className="mt-1 text-xs text-white/40">{sample ? "Illustrative figures. Not verified API data." : "Email includes a matching PDF attachment."}</p></div><div className="flex flex-wrap gap-2">{selected && !sample && ["CHECK_FAILED", "NEEDS_REVIEW"].includes(reports.find(r => r.id === selected)?.status || "") && <button className={button} disabled={busy} onClick={() => action({ action: "recheck", reportId: selected })}>Retry account check</button>}<button className={button} disabled={busy || !html || issues.length > 0} onClick={downloadPdf}>Download PDF</button><button className={button} onClick={() => setMobile(!mobile)}>{mobile ? "Desktop" : "Mobile"}</button><button className={button} disabled={busy || sample || !selected || !html || issues.length > 0} onClick={() => { if (!testRequest.current || testRequest.current.report !== selected) testRequest.current = { report: selected, id: crypto.randomUUID() }; action({ action: "test", reportId: selected, requestId: testRequest.current.id }); }}>Send test to Jake</button>{selected && !sample && ["READY", "FAILED"].includes(reports.find(r => r.id === selected)?.status || "") && <button className={button} disabled={busy || !settings?.liveApproved || !html || issues.length > 0} onClick={() => { const report = reports.find(r => r.id === selected); if (window.confirm(`Send ${monthLabel} summary and PDF to ${report?.recipientEmail}?`)) action({ action: "send", reportId: selected, requestId: crypto.randomUUID(), confirmSend: true }); }}>Send to client</button>}{settings?.liveApproved && reports.find(r => r.id === selected)?.status === "ACCEPTED" && <button className={button} disabled={busy} onClick={() => { if (!window.confirm("Send another copy of this saved summary to the client? This does not change purchase data.")) return; if (!resendRequest.current || resendRequest.current.report !== selected) resendRequest.current = { report: selected, id: crypto.randomUUID() }; action({ action: "resend", reportId: selected, requestId: resendRequest.current.id, confirmResend: true }); }}>Resend to client</button>}</div></div>
      {reviewNotes.length > 0 && <div className="border-b border-white/10 p-5 text-sm text-amber-100/80"><p className="mb-2 font-medium">Review before client delivery</p><ul className="list-disc space-y-2 pl-5">{reviewNotes.map(note => <li key={note}>{note}</li>)}</ul></div>}
      {issues.length > 0 && <div className="p-6"><p className="mb-3 text-amber-100">This account needs attention before a summary can be used.</p><ul className="list-disc space-y-2 pl-5 text-sm text-white/60">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      {html ? <div className="bg-[#242723] p-2 sm:p-4"><iframe title="Monthly media summary email preview" sandbox="" srcDoc={html} className="mx-auto block h-[1050px] max-w-full border-0 bg-white" style={{ width: mobile ? 375 : "100%" }} /></div> : !issues.length && <p className="p-10 text-center text-sm text-white/40">Select a report or open the design sample.</p>}
      {history.length > 0 && <div className="p-5"><h3 className="mb-3 text-sm text-white">Send history</h3><ul className="space-y-3">{history.map(attempt => <li key={attempt.id} className="rounded-xl border border-white/10 p-3 text-xs leading-6 text-white/60"><p>{attempt.kind} · {attempt.status} · {timestamp(attempt.createdAt)} MT · {attempt.attemptCount} attempt(s)</p><p className="break-all">{attempt.recipientEmail}</p>{attempt.providerMessageId && <p className="break-all">Resend ID: {attempt.providerMessageId}</p>}{attempt.error && <p className="text-amber-100">{attempt.error}</p>}{attempt.status === "FAILED" && (attempt.kind === "TEST" || settings?.liveApproved) && <button className={`${button} mt-2`} disabled={busy} onClick={() => action({ action: "retry", reportId: selected, attemptId: attempt.id })}>Retry failed send</button>}</li>)}</ul><p className="mt-3 text-xs text-white/35">Accepted means Resend received the message; it does not confirm inbox delivery. Uncertain attempts require review before resending.</p></div>}
      </section>
    </div>
  </div>;
}
