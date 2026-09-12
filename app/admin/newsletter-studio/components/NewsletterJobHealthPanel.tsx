"use client";

import { useEffect, useRef, useState } from "react";
import { requestNewsletterJobHealth, type NewsletterJobHealth } from "./job-health-client";

const labels = { PENDING: "Queued", ACTIVE: "Active claim", REVIEW: "Claim needs review", FAILED: "Failed" };
const types = { GENERATE: "Generation", SEND: "Delivery", MISSED_APPROVAL: "Approval deadline", NOTIFY: "Notification" };

export default function NewsletterJobHealthPanel() {
  const [health, setHealth] = useState<NewsletterJobHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function refresh() {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(""); setHealth(null);
    try {
      const result = await requestNewsletterJobHealth(controller.signal);
      if (!controller.signal.aborted) setHealth(result);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Job status is unavailable. Refresh to try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (pending.current === controller) pending.current = null;
    }
  }
  return <section aria-labelledby="newsletter-job-health-title" className="mt-7 space-y-5 rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="newsletter-job-health-title" className="text-2xl font-light text-white">Newsletter jobs</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/60">Inspect queued work and claims that may need attention. This view never starts, retries or cancels work.</p></div>
      <button className="admin-btn-secondary" onClick={() => void refresh()} disabled={busy}>{busy ? "Checking jobs…" : "Refresh job status"}</button>
    </div>
    <p role="status" aria-live="polite" className="text-sm text-white/75">{error || (busy ? "Loading job status." : health ? "Job status loaded." : "Load job status to inspect current work.")}</p>
    {health && <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['pending', 'Queued'], ['active', 'Active claims'], ['review', 'Claims needing review'], ['failed', 'Failed']] as const).map(([key, label]) => <div key={key} className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/60">{label}</dt><dd className="mt-2 text-2xl text-white">{health.counts[key]}</dd></div>)}</dl>
      <p className="text-xs text-white/60">Snapshot: <time dateTime={health.observedAt}>{new Date(health.observedAt).toLocaleString()}</time>. An active lease does not prove a worker is still running. Expired or missing leases require review, not an automatic retry.</p>
      {health.truncated && <p className="text-sm text-white/70">Showing the 50 most recently updated unfinished jobs. Totals include all matching jobs.</p>}
      {health.jobs.length === 0 ? <p className="text-sm text-white/70">No queued, claimed or failed jobs were found.</p> : <ul className="space-y-3">{health.jobs.map(job => <li key={job.id} className="space-y-2 rounded-xl border border-white/10 p-4 text-sm text-white/70">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="min-w-0 break-words font-medium text-white">{job.editionLabel}</h3><span>{labels[job.state]}</span></div>
        <p>{types[job.type]} · Attempts: {job.attempts} · Series: {job.seriesStatus.toLowerCase()} · Edition: {job.editionStatus.replaceAll("_", " ").toLowerCase()}</p>
        {job.type === "NOTIFY" && <p>This job type has no worker implementation and remains held for review.</p>}
        <p>Due: <time dateTime={job.dueAt}>{new Date(job.dueAt).toLocaleString()}</time></p>
        <a className="inline-block underline underline-offset-4 focus-visible:outline" href={`/admin/newsletter-studio/editions/${encodeURIComponent(job.editionId)}${job.type === "GENERATE" ? "#generation-recovery-title" : job.type === "SEND" ? "#delivery-review-title" : ""}`}>Open edition review<span className="sr-only"> for {job.editionLabel}</span></a>
      </li>)}</ul>}
    </>}
  </section>;
}
