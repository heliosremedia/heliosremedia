'use client';

import { useEffect, useRef, useState } from 'react';
import type { inspectAnalyticsRecovery, listAnalyticsRecovery } from '@/lib/social/analytics-recovery';

type Review = Awaited<ReturnType<typeof inspectAnalyticsRecovery>>;
type Jobs = Awaited<ReturnType<typeof listAnalyticsRecovery>>;
const endpoint = '/api/admin/social/analytics/jobs';

export default function AnalyticsRecoveryPanel() {
  const [jobs, setJobs] = useState<Jobs | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Load analytics jobs to inspect recorded running claims. Administrator access is required.');
  const pending = useRef<AbortController | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => () => { const controller = pending.current; pending.current = null; controller?.abort(); }, []);
  useEffect(() => { if (review) reviewHeading.current?.focus(); }, [review]);

  async function request(kind: 'list' | 'review' | 'cancel', jobId?: string) {
    if (pending.current) return;
    if (kind === 'cancel' && (!review || !review.eligible || !review.cancellationEnabled || !confirmed)) return;
    const previousReview = review;
    const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 20_000);
    setBusy(true); setConfirmed(false); setReview(null); setMessage('Checking analytics job state.');
    if (kind === 'list') setJobs(null);
    try {
      const response = await fetch(kind === 'list' ? endpoint : `${endpoint}/${encodeURIComponent(jobId!)}/recovery`, {
        method: kind === 'cancel' ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
        ...(kind === 'cancel' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          action: 'cancel', confirmed: true, reviewVersion: previousReview!.reviewVersion,
        }) } : {}),
      });
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        setJobs(null); setMessage('Administrator access is required. Sign in again or ask a workspace administrator.'); return;
      }
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || body.success !== true) throw new Error('Unconfirmed response');
      if (kind === 'list') {
        if (!Array.isArray(body.jobs) || body.jobs.length > 50 || typeof body.observedAt !== 'string'
          || body.jobs.some((job: Record<string, unknown> | null) => !job || typeof job.jobId !== 'string'
            || typeof job.platform !== 'string' || typeof job.attempts !== 'number'
            || (job.claimedAt !== null && typeof job.claimedAt !== 'string'))) throw new Error('Invalid jobs');
        setJobs(body); setMessage('Recorded running jobs loaded. A running status does not prove a worker is still active.');
      } else if (kind === 'review') {
        const value = body.review;
        if (!value || value.jobId !== jobId || typeof value.reviewVersion !== 'string' || !/^[a-f0-9]{64}$/.test(value.reviewVersion)
          || typeof value.status !== 'string' || typeof value.eligible !== 'boolean' || typeof value.cancellationEnabled !== 'boolean'
          || value.automaticRetryAllowed !== false || (value.eligible && value.status !== 'RUNNING')) throw new Error('Invalid review');
        setReview(value); setMessage('Fresh review loaded. No action has been taken.');
      } else {
        if (body.result?.jobId !== jobId || body.result?.status !== 'CANCELLED') throw new Error('Unconfirmed cancellation');
        setJobs(current => current ? { ...current, jobs: current.jobs.filter(job => job.jobId !== jobId) } : null);
        setMessage('Analytics cancellation recorded. Existing metrics remain intact. No provider request or retry was started.');
      }
    } catch {
      if (pending.current === controller) setMessage(kind === 'cancel'
        ? 'Cancellation could not be confirmed. Load a fresh review before taking another action. Do not blindly retry.'
        : 'Analytics job state is unavailable or changed. Load a fresh review to try again.');
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }

  return <section aria-labelledby="analytics-recovery-title" className="space-y-4 rounded-2xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <h2 id="analytics-recovery-title" className="text-2xl font-light text-white">Analytics job review</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/60">Inspect held analytics reads without publishing or retrying anything. Cancellation requires a fresh review and explicit confirmation.</p>
    </div><button disabled={busy} onClick={() => void request('list')} className="admin-btn-secondary">Load analytics jobs</button></div>
    <p role="status" aria-live="polite" className="text-sm text-white/75">{message}</p>
    {jobs && <><p className="text-xs text-white/60">Snapshot: {new Date(jobs.observedAt).toLocaleString()}. {jobs.truncated ? 'Showing the first 50 recorded running jobs. Reload after reviewing them.' : ''}</p>
      {jobs.jobs.length ? <ul className="space-y-2">{jobs.jobs.map(job => <li key={job.jobId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm text-white/70">
        <div><p className="break-all">{job.platform} · {job.jobId}</p><p>Claim recorded: {job.claimedAt ? new Date(job.claimedAt).toLocaleString() : 'Unknown'} · Attempts: {job.attempts}</p></div>
        <button className="admin-btn-secondary" disabled={busy} onClick={() => void request('review', job.jobId)}>Review analytics job<span className="sr-only"> {job.jobId}</span></button>
      </li>)}</ul> : <p className="text-sm text-white/60">No recorded running analytics jobs were found.</p>}</>}
    {review && <div className="space-y-4 rounded-xl border border-amber-300/25 p-4">
      <h3 ref={reviewHeading} tabIndex={-1} className="break-all text-lg text-white">Review {review.jobId}: {review.status}</h3>
      <p className="text-sm text-white/70">Cancellation stops this claim from recording further results. It does not abort a provider request. Existing metrics stay intact and no retry is queued. The 30-minute review threshold does not prove the worker has stopped.</p>
      {!review.cancellationEnabled ? <p className="text-sm text-amber-100">Cancellation is disabled pending worker compatibility checks and recovery QA.</p>
        : !review.eligible ? <p className="text-sm text-amber-100">This job is not eligible for cancellation. Recent claims, missing claim evidence and terminal jobs remain blocked.</p>
        : <><label className="flex items-start gap-3 text-sm text-white/80"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />I reviewed this analytics claim and understand that cancellation preserves existing metrics and starts no retry.</label>
          <button className="admin-btn-secondary" disabled={busy || !confirmed} onClick={() => void request('cancel', review.jobId)}>Confirm analytics cancellation</button></>}
    </div>}
  </section>;
}
