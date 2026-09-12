// Synthetic, browser-only fixture. Bundle with esbuild; never mount in the application.
import React from "react";
import { createRoot } from "react-dom/client";
import GenerationRecoveryPanel from "../../app/admin/newsletter-studio/components/GenerationRecoveryPanel";
import NewsletterJobHealthPanel from "../../app/admin/newsletter-studio/components/NewsletterJobHealthPanel";
import AnalyticsRecoveryPanel from "../../app/admin/social-studio/analytics/AnalyticsRecoveryPanel";
import PublishingReviewPanel from "../../app/admin/social-studio/queue/PublishingReviewPanel";

let recovered = false;
window.recoveryFixture = { calls: [], mode: "eligible" };
window.jobHealthFixture = { calls: [], mode: "healthy" };
window.analyticsRecoveryFixture = { calls: [], mode: "eligible", cancelled: false };
window.publishingReviewFixture = { calls: [], mode: 'unknown' };
window.fetch = async (url, options = {}) => {
  if (url.startsWith('/api/admin/social/publishing-jobs/')) {
    const fixture = window.publishingReviewFixture;
    fixture.calls.push({ url, method: options.method });
    await new Promise(resolve => setTimeout(resolve, 80));
    if (fixture.mode === 'forbidden') return Response.json({ success: false, error: 'PRIVATE error' }, { status: 403 });
    if (fixture.mode === 'not-found') return Response.json({ success: false }, { status: 404 });
    if (fixture.mode === 'unavailable') throw new Error('PRIVATE network failure');
    const states = { unknown: ['PUBLISHING', 'OUTCOME_UNCONFIRMED'], validating: ['VALIDATING', 'VALIDATION_UNRESOLVED'],
      processing: ['PROVIDER_PROCESSING', 'PROVIDER_PROCESSING_RECORDED'], published: ['PUBLISHED', 'LOCAL_PUBLICATION_RECORDED'] };
    const [status, assessment] = states[fixture.mode] || states.unknown;
    return Response.json({ success: true, review: { jobId: fixture.mode === 'malformed' ? 'foreign-job' : 'publish/job-a', status, assessment,
      platform: 'FACEBOOK', attempts: 1, claimedAt: null, completedAt: null, hasClaim: true, hasSubmission: false, hasExternalPost: false,
      currentVersion: fixture.mode === 'invalidated' ? 4 : 3, approvedVersion: 3, invalidatedAt: null, errorCategory: null,
      observedAt: '2026-09-12T23:00:00Z', attemptsTruncated: false, approvalRevisionChanged: fixture.mode === 'invalidated',
      attemptsLog: fixture.mode === 'published' ? [{ attemptNumber: 1, status: 'PUBLISHED', createdAt: '2026-09-12T23:00:00Z', errorCategory: null, hasSubmission: true, hasExternalPost: true }] : [],
      providerChecked: false, recoveryAllowed: false, automaticRetryAllowed: false } });
  }
  if (url.startsWith('/api/admin/social/analytics/jobs')) {
    const fixture = window.analyticsRecoveryFixture;
    fixture.calls.push({ url, method: options.method, body: options.body });
    await new Promise(resolve => setTimeout(resolve, 80));
    if (fixture.mode === 'forbidden') return Response.json({ success: false }, { status: 403 });
    if (url === '/api/admin/social/analytics/jobs') {
      if (fixture.mode === 'list-fails') return Response.json({ success: false }, { status: 503 });
      return Response.json({ success: true, observedAt: '2026-09-12T12:00:00Z', truncated: false,
        jobs: fixture.cancelled ? [] : [{ jobId: 'analytics/job-a', platform: 'FACEBOOK', attempts: 1, claimedAt: '2026-09-01T12:00:00Z', status: 'RUNNING' }] });
    }
    if (options.method === 'POST') {
      if (fixture.mode === 'stale') return Response.json({ success: false }, { status: 409 });
      fixture.cancelled = true;
      if (fixture.mode === 'ack-lost') throw new Error('Synthetic committed response loss');
      return Response.json({ success: true, result: { jobId: 'analytics/job-a', status: 'CANCELLED' } });
    }
    if (fixture.mode === 'malformed') return Response.json({ success: true, review: { jobId: 'foreign-job', eligible: true } });
    return Response.json({ success: true, review: { jobId: 'analytics/job-a', platform: 'FACEBOOK', status: fixture.cancelled ? 'CANCELLED' : 'RUNNING',
      reviewVersion: 'a'.repeat(64), eligible: !fixture.cancelled && fixture.mode !== 'blocked', cancellationEnabled: fixture.mode !== 'disabled',
      claimedAt: '2026-09-01T12:00:00Z', attempts: 1, observedAt: '2026-09-12T12:00:00Z', automaticRetryAllowed: false } });
  }
  if (url === "/api/admin/newsletters/jobs/health") {
    window.jobHealthFixture.calls.push({ url, method: options.method });
    await new Promise(resolve => setTimeout(resolve, 80));
    if (window.jobHealthFixture.mode === "unavailable") return Response.json({ success: false }, { status: 503 });
    return Response.json({ success: true, health: {
      observedAt: "2026-09-12T12:00:00Z", counts: { pending: 3, active: 1, review: 1, failed: 2 }, truncated: false, automaticRetryAllowed: false,
      jobs: [{ id: "job-a", editionId: "edition/a", type: "GENERATE", state: "REVIEW", dueAt: "2026-09-12T11:00:00Z", attempts: 1, editionLabel: "Synthetic interrupted edition", editionStatus: "GENERATING", seriesStatus: "ACTIVE" }],
    } });
  }
  const fixture = window.recoveryFixture;
  fixture.calls.push({ url, method: options.method, body: options.body });
  await new Promise(resolve => setTimeout(resolve, 80));
  if (fixture.mode === "forbidden") return Response.json({ success: false }, { status: 403 });
  if (options.method === "POST") {
    if (fixture.mode === "stale") return Response.json({ success: false }, { status: 409 });
    recovered = true;
    return Response.json({ success: true, editionStatus: "NEEDS_REVIEW", automaticRetryAllowed: false });
  }
  if (recovered && fixture.mode === "refresh-fails") throw new Error("Synthetic refresh failure");
  return Response.json({ success: true, review: {
    editionId: "synthetic-edition", rowVersion: recovered ? 7 : 6,
    editionStatus: recovered ? "NEEDS_REVIEW" : "GENERATING", runId: "synthetic-run",
    eligible: !recovered && fixture.mode !== "blocked", automaticRetryAllowed: false,
  } });
};
createRoot(document.getElementById("root")).render(<><label>Unsaved edition notes<textarea defaultValue="Keep my changes" /></label><GenerationRecoveryPanel editionId="synthetic-edition" /><NewsletterJobHealthPanel /><AnalyticsRecoveryPanel /><PublishingReviewPanel jobId="publish/job-a" /></>);
