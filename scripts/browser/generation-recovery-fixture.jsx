// Synthetic, browser-only fixture. Bundle with esbuild; never mount in the application.
import React from "react";
import { createRoot } from "react-dom/client";
import GenerationRecoveryPanel from "../../app/admin/newsletter-studio/components/GenerationRecoveryPanel";
import NewsletterJobHealthPanel from "../../app/admin/newsletter-studio/components/NewsletterJobHealthPanel";

let recovered = false;
window.recoveryFixture = { calls: [], mode: "eligible" };
window.jobHealthFixture = { calls: [], mode: "healthy" };
window.fetch = async (url, options = {}) => {
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
createRoot(document.getElementById("root")).render(<><label>Unsaved edition notes<textarea defaultValue="Keep my changes" /></label><GenerationRecoveryPanel editionId="synthetic-edition" /><NewsletterJobHealthPanel /></>);
