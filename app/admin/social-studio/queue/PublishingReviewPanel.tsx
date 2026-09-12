'use client';
import { useEffect, useRef, useState } from 'react';
import type { inspectPublishingReview } from '@/lib/social/publishing-review';

type Review = Awaited<ReturnType<typeof inspectPublishingReview>>;
const descriptions: Record<Review['assessment'], string> = {
  LOCAL_PUBLICATION_RECORDED: 'Studio recorded a published outcome. This inspection has not verified the current provider state.',
  PROVIDER_PROCESSING_RECORDED: 'Studio recorded provider processing. This is not a confirmed publication or a failed submission.',
  VALIDATION_UNRESOLVED: 'Validation is recorded as unfinished. Missing attempt evidence is not proof that no provider request occurred.',
  OUTCOME_UNCONFIRMED: 'The external outcome is unconfirmed. Check the destination and reconcile recorded evidence before any retry or manual publication.',
  RECORDED_STATE_REVIEW: 'This is recorded local state, not a fresh provider check. Review the evidence before deciding what to do next.',
};

export default function PublishingReviewPanel({ jobId }: { jobId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const title = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => () => { const controller = pending.current; pending.current = null; controller?.abort(); }, [jobId]);
  useEffect(() => { if (review) title.current?.focus(); }, [review]);
  async function inspect() {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 20_000);
    setBusy(true); setReview(null); setMessage('Loading recorded publication evidence.');
    try {
      const response = await fetch(`/api/admin/social/publishing-jobs/${encodeURIComponent(jobId)}/review`, { method: 'GET', cache: 'no-store', signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) { setMessage('Administrator access is required to inspect publication evidence.'); return; }
      if (response.status === 404) { setMessage('Publication evidence was not found in this workspace.'); return; }
      const body = await response.json();
      if (controller.signal.aborted) return;
      const value = body?.review;
      if (!response.ok || body?.success !== true || !value || value.jobId !== jobId || typeof value.status !== 'string'
        || !Object.hasOwn(descriptions, value.assessment) || value.providerChecked !== false || value.recoveryAllowed !== false
        || typeof value.currentVersion !== 'number' || typeof value.approvedVersion !== 'number' || typeof value.observedAt !== 'string'
        || typeof value.approvalRevisionChanged !== 'boolean' || typeof value.hasClaim !== 'boolean'
        || typeof value.hasSubmission !== 'boolean' || typeof value.hasExternalPost !== 'boolean'
        || value.automaticRetryAllowed !== false || !Array.isArray(value.attemptsLog) || value.attemptsLog.length > 10
        || value.attemptsLog.some((attempt: Record<string, unknown> | null) => !attempt || typeof attempt.attemptNumber !== 'number'
          || typeof attempt.status !== 'string' || typeof attempt.createdAt !== 'string')) throw new Error('Invalid evidence');
      setReview(value); setMessage('Recorded evidence loaded. Nothing has been published, retried or changed.');
    } catch {
      if (pending.current === controller) setMessage('Publication evidence is unavailable. Inspect again before taking any action. Nothing was retried.');
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  // A changed row must never display evidence retained from its previous identity.
  const visible = review?.jobId === jobId ? review : null;
  return <section aria-label={`Publication evidence ${jobId}`} className="space-y-3 lg:col-span-2">
    <button className="admin-btn-secondary" disabled={busy} onClick={() => void inspect()}>Inspect publication evidence<span className="sr-only"> {jobId}</span></button>
    {message && <p role="status" aria-live="polite" className="text-sm text-white/70">{message}</p>}
    {visible && <div className="space-y-3 rounded-xl border border-white/10 p-4 text-sm text-white/70">
      <h3 ref={title} tabIndex={-1} className="break-all text-lg text-white">Recorded publication: {visible.status}</h3>
      <p>{descriptions[visible.assessment]}</p>
      <p className="text-amber-100">This view is read-only. It cannot authorize retry, cancel a submission, mark it published or reconcile the provider outcome.</p>
      <p>Claim recorded: {visible.hasClaim ? 'Yes' : 'No'} · Submission reference recorded: {visible.hasSubmission ? 'Yes' : 'No'} · External post reference recorded: {visible.hasExternalPost ? 'Yes' : 'No'}</p>
      <p>Current revision: {visible.currentVersion} · Approved snapshot revision: {visible.approvedVersion}. {visible.approvalRevisionChanged ? 'Approval revision changed or snapshot invalidated. A new approval may be required.' : 'Matching revision numbers alone do not verify all approval requirements.'}</p>
      <p>Snapshot: {new Date(visible.observedAt).toLocaleString()}. {visible.attemptsTruncated ? 'Showing the 10 most recent recorded attempts.' : ''}</p>
      {visible.attemptsLog.length ? <ol className="space-y-2">{visible.attemptsLog.map(attempt => <li key={attempt.attemptNumber} className="rounded-lg border border-white/10 p-3">
        Attempt {attempt.attemptNumber}: {attempt.status} · {new Date(attempt.createdAt).toLocaleString()}
        <p>Submission reference: {attempt.hasSubmission ? 'Recorded' : 'Not recorded'} · External post reference: {attempt.hasExternalPost ? 'Recorded' : 'Not recorded'}</p>
      </li>)}</ol> : <p>No settled attempt is recorded. Absence of a record does not prove that the provider was never called.</p>}
    </div>}
  </section>;
}
