"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Campaign = {
  id: string;
  internalName: string;
  publicTitle: string;
  purpose: string;
  status: string;
  rowVersion: number;
  referralOffer: string | null;
  advocateReward: string | null;
  referredCustomerOffer: string | null;
  eligibilityRules: string | null;
  qualificationRules: string | null;
  terms: string;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  landingHeadline: string;
  landingBody: string;
  landingThankYou: string;
  privacyNotice: string;
  invitationSubject: string;
  invitationPreviewText: string | null;
  invitationBody: string;
  startsAt: string | null;
  endsAt: string | null;
  approvedRevisionId: string | null;
  expectedAdvocateCount: number | null;
  preparedAdvocateCount: number;
  preparedInvitationCount: number;
  preparedCommunicationCount: number;
  launchBatch: number;
  launchFailedAt: string | null;
  launchStartedAt: string | null;
  launchLeaseExpiresAt: string | null;
  lastLaunchError: string | null;
  lastProgressAt: string | null;
  stalled: boolean;
  recoveryMode: string;
  sentCount: number;
  operationalState: string;
  operationalLabel: string;
  invitationSentCount: number;
  deliveryScheduledAt: string | null;
  deliveryTimezone: string;
  scheduleConfirmedAt: string | null;
  nextScheduledAt: string | null;
  nextAction: string;
  lastWorkerActivityAt: string | null;
  lastProviderActivityAt: string | null;
  sequence: { steps: number; followUps: number; estimatedMessages: number };
  followUpConfiguration: {
    enabled?: boolean;
    count?: number;
    delayDays?: number;
  };
  communicationTemplates: { followUp?: string };
  communicationCounts: Record<string, number>;
  audiences: Array<{
    id: string;
    excluded: boolean;
    group: { name: string } | null;
    client: { displayName: string; email: string } | null;
  }>;
  advocates: Array<{
    id: string;
    client: { displayName: string; email: string };
    recommendationReason: string | null;
    recommendationScore: number | null;
    recommendationWarnings: unknown;
    _count: { submissions: number; rewards: number };
  }>;
  submissions: Array<{
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    attributionStatus: string;
    createdAt: string;
    advocate: { client: { displayName: string } } | null;
  }>;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    approvedAt: string | null;
    createdAt: string;
  }>;
  auditEvents: Array<{
    id: string;
    action: string;
    summary: string;
    createdAt: string;
  }>;
  _count: { invitations: number; submissions: number };
  audienceEstimate: {
    eligible: Array<{ id: string; displayName: string; email: string }>;
    excluded: Array<{ id: string; displayName: string; reasons: string[] }>;
  };
  removalEligibility: {
    hasActivity: boolean;
    canDelete: boolean;
    canArchive: boolean;
  };
};

const tabs = [
  "Overview",
  "Audience",
  "Invitation",
  "Landing Page",
  "Pipeline",
  "Approval",
  "History",
] as const;
const tone = (status: string) =>
  ["ACTIVE", "APPROVED", "COMPLETED"].includes(status)
    ? "text-emerald-200 border-emerald-300/20"
    : status === "PAUSED"
      ? "text-amber-100 border-amber-200/20"
      : "text-white/45 border-white/10";

export default function CampaignWorkspace({
  campaignId,
  adminEmail,
}: {
  campaignId: string;
  adminEmail: string;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [firstSendAt, setFirstSendAt] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("America/Denver");
  const [testEmail, setTestEmail] = useState(adminEmail);
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/admin/referrals/campaigns/${campaignId}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok || !result.success)
      throw new Error(result.error || "Campaign could not be loaded.");
    setCampaign(result.campaign);
  }, [campaignId]);
  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/referrals/campaigns/${campaignId}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success)
          throw new Error(result.error || "Campaign could not be loaded.");
        if (active) {
          setCampaign(result.campaign);
          if (
            new URLSearchParams(window.location.search).get("tab") ===
            "Approval"
          )
            setTab("Approval");
        }
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : "Campaign could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, [campaignId]);
  useEffect(() => {
    if (campaign?.status !== "LAUNCHING" || campaign.launchFailedAt) return;
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [campaign?.launchFailedAt, campaign?.status, load]);
  async function action(name: string) {
    setBusy(name);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/referrals/campaigns/${campaignId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: name,
            rowVersion: campaign?.rowVersion,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "The action could not be completed.");
      if (result.deleted) {
        window.location.assign(
          "/admin/referral-studio?notice=campaign-deleted",
        );
        return;
      }
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function recoveryAction(
    name: "stop-preparation" | "return-to-approved" | "retry-safe",
  ) {
    const copy =
      name === "retry-safe"
        ? "Retry preparation from the approved snapshot? No already-prepared active recipient will be duplicated, and delivery still follows the approved schedule."
        : name === "return-to-approved"
          ? "Stop preparation and return to the existing Approved snapshot? No communications will be sent. Fresh launch confirmation will be required."
          : "Stop preparation and cancel this campaign? Unsent records will be cancelled and audit history will remain.";
    if (!window.confirm(copy)) return;
    await action(name);
  }
  async function returnToDraft(editAfter = false) {
    if (
      !campaign ||
      !window.confirm(
        "Returning this campaign to Draft removes its approval. You may edit it, but it must be approved again before launch.",
      )
    )
      return;
    setBusy(editAfter ? "edit" : "return-to-draft");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/referrals/campaigns/${campaignId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: editAfter ? "edit-approved" : "return-to-draft",
            rowVersion: campaign.rowVersion,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error || "The campaign could not be returned to Draft.",
        );
      if (editAfter)
        window.location.assign(
          `/admin/referral-studio/campaigns/${campaign.id}/edit`,
        );
      else {
        setMessage(result.message);
        await load();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The campaign could not be returned to Draft.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function removeCampaign() {
    if (
      !campaign ||
      !window.confirm(
        `Permanently delete “${campaign.internalName}”? This cannot be undone.`,
      )
    )
      return;
    await action("delete");
  }
  async function archiveCampaign() {
    if (
      !campaign ||
      !window.confirm(
        `Archive “${campaign.internalName}”? Its history will remain available.`,
      )
    )
      return;
    await action("archive");
  }
  async function sendTest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("test");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/referrals/campaigns/${campaignId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test", testEmail }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "The test could not be sent.");
      setMessage(result.message);
      setTestOpen(false);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The test could not be sent.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function scheduleCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("schedule");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/referrals/campaigns/${campaignId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          firstSendAt,
          timezone: scheduleTimezone,
            confirmation: "SCHEDULE",
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "The schedule could not be confirmed.");
      setMessage(result.message);
      setScheduleOpen(false);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The schedule could not be confirmed.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function openScheduleReview() {
    setScheduleTimezone(campaign?.deliveryTimezone || "America/Denver");
    setScheduleOpen(true);
    try {
      await fetch(`/api/admin/referrals/campaigns/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scheduling-review-opened",
          timezone: campaign?.deliveryTimezone,
        }),
      });
    } catch {
      // Audit telemetry must never prevent an administrator from reviewing.
    }
  }
  async function saveWithoutScheduling() {
    setBusy("save-schedule-draft");
    try {
      const response = await fetch(
        `/api/admin/referrals/campaigns/${campaignId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-schedule-draft",
            timezone: scheduleTimezone,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "The review could not be saved.");
      setMessage(result.message);
      setScheduleOpen(false);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The review could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function cancelSchedule() {
    if (
      !window.confirm(
        "Cancel every future unsent message in this schedule? Sent history will be preserved.",
      )
    )
      return;
    setBusy("cancel-schedule");
    try {
      const response = await fetch(
        `/api/admin/referrals/campaigns/${campaignId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cancel-schedule",
            confirmation: "CANCEL SCHEDULE",
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "The schedule could not be cancelled.");
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The schedule could not be cancelled.",
      );
    } finally {
      setBusy(null);
    }
  }
  if (!campaign)
    return (
      <div className="space-y-4">
        {message && (
          <p role="alert" className="text-red-100">
            {message}
          </p>
        )}
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.02]"
          />
        ))}
      </div>
    );
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin/referral-studio"
            className="text-xs text-white/35 transition hover:text-white"
          >
            ← Referral Studio
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-light text-white sm:text-4xl">
              {campaign.internalName}
            </h1>
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.54rem] uppercase tracking-[.14em] ${tone(campaign.operationalState)}`}
            >
              {campaign.operationalLabel}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">
            {campaign.purpose}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!!busy}
            onClick={() => setTestOpen(true)}
            className="admin-btn-secondary"
          >
            Send test
          </button>
          {campaign.status === "DRAFT" && (
            <Link
              href={`/admin/referral-studio/campaigns/${campaign.id}/edit`}
              className="admin-btn-primary"
            >
              Edit Campaign
            </Link>
          )}
          {campaign.status === "DRAFT" && (
            <button
              disabled={!!busy}
              onClick={() => setTab("Approval")}
              className="admin-btn-secondary"
            >
              Review &amp; approve
            </button>
          )}
          {campaign.status === "APPROVED" &&
            campaign.preparedAdvocateCount === 0 && (
              <button
                disabled={!!busy}
                onClick={() => action("launch")}
                className="admin-btn-primary"
              >
                {busy === "launch" ? "Preparing Campaign…" : "Prepare campaign"}
              </button>
            )}
          {campaign.operationalState === "APPROVED_NOT_SCHEDULED" &&
            campaign.preparedAdvocateCount > 0 && (
              <button
                disabled={!!busy}
                onClick={() => void openScheduleReview()}
                className="admin-btn-primary"
              >
                Review &amp; Schedule
              </button>
            )}
          {campaign.operationalState === "SCHEDULED" && (
            <button
              disabled={!!busy}
              onClick={() => void openScheduleReview()}
              className="admin-btn-primary"
            >
              Edit Schedule
            </button>
          )}
          {campaign.operationalState === "SCHEDULED" && (
            <button
              disabled={!!busy}
              onClick={() => void cancelSchedule()}
              className="admin-btn-secondary"
            >
              Cancel Schedule
            </button>
          )}
          {campaign.status === "LAUNCHING" && campaign.launchFailedAt && (
            <button
              disabled={!!busy}
              onClick={() => void recoveryAction("retry-safe")}
              className="admin-btn-primary"
            >
              {busy === "retry-safe" ? "Retrying…" : "Retry Safely"}
            </button>
          )}
          {campaign.status === "LAUNCHING" && !campaign.launchFailedAt && (
            <button disabled className="admin-btn-primary">
              Preparing Campaign…
            </button>
          )}
          {campaign.status === "APPROVED" && (
            <button
              disabled={!!busy}
              onClick={() => void returnToDraft(false)}
              className="admin-btn-secondary"
            >
              {busy === "return-to-draft" ? "Returning…" : "Return to Draft"}
            </button>
          )}
          {campaign.status === "APPROVED" && (
            <button
              disabled={!!busy}
              onClick={() => void returnToDraft(true)}
              className="admin-btn-secondary"
            >
              {busy === "edit" ? "Opening…" : "Edit Campaign"}
            </button>
          )}
          {campaign.status === "ACTIVE" && (
            <button
              disabled={!!busy}
              onClick={() => action("pause")}
              className="admin-btn-secondary"
            >
              {busy === "pause" ? "Pausing…" : "Pause"}
            </button>
          )}
          {campaign.status === "PAUSED" && (
            <button
              disabled={!!busy}
              onClick={() => action("resume")}
              className="admin-btn-primary"
            >
              {busy === "resume" ? "Resuming…" : "Resume"}
            </button>
          )}
          {campaign.removalEligibility.canDelete && (
            <button
              disabled={!!busy}
              onClick={() => void removeCampaign()}
              className="admin-btn-destructive"
            >
              {busy === "delete" ? "Deleting…" : "Delete Campaign"}
            </button>
          )}
          {!campaign.removalEligibility.canDelete &&
            campaign.removalEligibility.canArchive && (
              <button
                disabled={!!busy}
                onClick={() => void archiveCampaign()}
                className="admin-btn-destructive"
              >
                {busy === "archive" ? "Archiving…" : "Archive Campaign"}
              </button>
            )}
        </div>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60"
        >
          {message}
        </p>
      )}
      <section
        aria-labelledby="campaign-status-title"
        className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.04] to-transparent p-5 sm:p-7"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.56rem] font-semibold uppercase tracking-[.18em] text-[var(--helios-orange)]">
              Operational status
            </p>
            <h2
              id="campaign-status-title"
              className="mt-3 text-2xl font-light text-white"
            >
              {campaign.operationalLabel} ·{" "}
              {campaign.expectedAdvocateCount ??
                campaign.audienceEstimate.eligible.length}{" "}
              advocates · {campaign.invitationSentCount} invitations sent
            </h2>
            <p className="mt-2 text-sm text-white/45">
              Next action: {campaign.nextAction}
            </p>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-sm text-white/65">
              Next send:{" "}
              {campaign.nextScheduledAt
                ? new Date(campaign.nextScheduledAt).toLocaleString()
                : "Not scheduled"}
            </p>
            <p className="mt-1 text-xs text-white/30">
              {campaign.deliveryTimezone || "America/Denver"}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Approved advocates"
            value={campaign.expectedAdvocateCount ?? 0}
          />
          <Metric
            label="Prepared advocates"
            value={campaign.preparedAdvocateCount}
          />
          <Metric
            label="Follow-ups scheduled"
            value={
              campaign.communicationCounts.SCHEDULED
                ? Math.max(
                    0,
                    campaign.communicationCounts.SCHEDULED -
                      (campaign.expectedAdvocateCount ?? 0),
                  )
                : 0
            }
          />
          <Metric
            label="Failed / suppressed"
            value={
              (campaign.communicationCounts.FAILED ?? 0) +
              campaign.audienceEstimate.excluded.length
            }
          />
        </div>
        <div className="mt-5 grid gap-3 text-xs text-white/40 sm:grid-cols-2 lg:grid-cols-4">
          <p>Delivery mode: approval required</p>
          <p>
            {campaign.sequence.steps}-message sequence ·{" "}
            {campaign.sequence.estimatedMessages} estimated messages
          </p>
          <p>
            Worker:{" "}
            {campaign.lastWorkerActivityAt
              ? new Date(campaign.lastWorkerActivityAt).toLocaleString()
              : "No activity recorded"}
          </p>
          <p>
            Provider:{" "}
            {campaign.lastProviderActivityAt
              ? new Date(campaign.lastProviderActivityAt).toLocaleString()
              : "No activity recorded"}
          </p>
        </div>
      </section>
      {campaign.status === "LAUNCHING" && (
        <section
          aria-live="polite"
          className={`rounded-xl border px-5 py-5 ${campaign.launchFailedAt || campaign.stalled ? "border-red-300/15 bg-red-300/[0.04]" : "border-[#e7ddc8]/15 bg-[#e7ddc8]/[0.04]"}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-white/70">
                {campaign.stalled
                  ? "Campaign preparation is stalled."
                  : campaign.launchFailedAt
                    ? "Campaign preparation stopped before completion."
                    : "Preparing campaign…"}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/35">
                {campaign.stalled
                  ? "Automatic recovery is disabled. Review the verified counts below and choose an explicit recovery action."
                  : campaign.launchFailedAt
                    ? campaign.lastLaunchError ||
                      "Retry is safe and will not create duplicates."
                    : `Preparing referral advocates and scheduled invitations securely. You may leave this page. ${campaign.preparedAdvocateCount} of ${campaign.expectedAdvocateCount ?? 0} advocates prepared.`}
              </p>
            </div>
            {!campaign.launchFailedAt && (
              <span className="text-xs text-white/30">
                Batch {campaign.launchBatch + 1}
              </span>
            )}
          </div>
          {!campaign.launchFailedAt && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[var(--helios-orange)] transition-[width]"
                style={{
                  width: `${Math.min(100, Math.round((campaign.preparedAdvocateCount / Math.max(1, campaign.expectedAdvocateCount ?? 1)) * 100))}%`,
                }}
              />
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Approved audience"
              value={campaign.expectedAdvocateCount ?? 0}
            />
            <Metric label="Prepared" value={campaign.preparedAdvocateCount} />
            <Metric
              label="Scheduled"
              value={campaign.communicationCounts.SCHEDULED ?? 0}
            />
            <Metric label="Sent" value={campaign.sentCount} />
          </div>
          <dl className="mt-5 grid gap-3 text-xs text-white/40 sm:grid-cols-2">
            <div>
              <dt className="uppercase tracking-[.12em] text-white/25">
                Started
              </dt>
              <dd className="mt-1">
                {campaign.launchStartedAt
                  ? new Date(campaign.launchStartedAt).toLocaleString()
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-[.12em] text-white/25">
                Last progress
              </dt>
              <dd className="mt-1">
                {campaign.lastProgressAt
                  ? new Date(campaign.lastProgressAt).toLocaleString()
                  : "No completed batch recorded"}
              </dd>
            </div>
          </dl>
          {(campaign.stalled || campaign.launchFailedAt) &&
            campaign.sentCount === 0 && (
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  disabled={!!busy}
                  onClick={() => void recoveryAction("return-to-approved")}
                  className="admin-btn-secondary"
                >
                  Return to Approved
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => void recoveryAction("retry-safe")}
                  className="admin-btn-primary"
                >
                  Retry Safely
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => void recoveryAction("stop-preparation")}
                  className="admin-btn-destructive"
                >
                  Cancel Campaign
                </button>
              </div>
            )}
          {campaign.sentCount > 0 && (
            <p className="mt-5 text-xs leading-5 text-amber-100/65">
              Some communications have already been sent. Return to Approved is
              unavailable; pause or cancel with the existing lifecycle controls
              to preserve delivery history.
            </p>
          )}
        </section>
      )}
      {!campaign.removalEligibility.canDelete &&
        campaign.removalEligibility.hasActivity &&
        ["DRAFT", "APPROVED"].includes(campaign.status) && (
          <p className="rounded-xl border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3 text-sm text-amber-50/60">
            Permanent deletion is unavailable because this campaign has referral
            activity. Archive it to preserve historical and compliance records.
          </p>
        )}
      {scheduleOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setScheduleOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-title"
            onSubmit={scheduleCampaign}
            className="my-6 w-full max-w-3xl rounded-2xl border border-white/10 bg-[#141412] p-6 shadow-2xl sm:p-8"
          >
            <p className="text-[0.56rem] uppercase tracking-[.18em] text-[var(--helios-orange)]">
              Final delivery review
            </p>
            <h2
              id="schedule-title"
              className="mt-3 text-3xl font-light text-white"
            >
              Review &amp; Schedule
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/40">
              Nothing is sent when you open this review. Confirming creates the
              future schedule shown below.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Metric label="Campaign" value={campaign.internalName} />
              <Metric
                label="Eligible audience"
                value={campaign.expectedAdvocateCount ?? 0}
              />
              <Metric
                label="Excluded / suppressed"
                value={campaign.audienceEstimate.excluded.length}
              />
              <Metric
                label="Estimated total messages"
                value={campaign.sequence.estimatedMessages}
              />
            </div>
            <div className="mt-5 rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.05] p-5 text-center">
              <p className="text-sm text-white/55">
                {campaign.expectedAdvocateCount ?? 0} advocates
              </p>
              <p className="mt-1 text-sm text-white/55">
                × {campaign.sequence.steps} messages
              </p>
              <p className="mt-2 text-2xl font-light text-white">
                = {campaign.sequence.estimatedMessages} maximum planned messages
              </p>
              <p className="mt-2 text-xs text-white/35">
                This is the complete sequence total, not{" "}
                {campaign.sequence.estimatedMessages} recipients.
              </p>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] p-4">
                <Data
                  label="Sender"
                  value={[campaign.senderName, campaign.senderEmail]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <Data label="Reply-to" value={campaign.replyTo || adminEmail} />
                <Data label="Subject" value={campaign.invitationSubject} />
                <Data
                  label="Preview text"
                  value={campaign.invitationPreviewText}
                />
              </div>
              <div className="rounded-xl border border-white/[0.07] p-4">
                <Data
                  label="Sequence"
                  value={`${campaign.sequence.steps} messages: initial invitation${campaign.sequence.followUps ? ` + ${campaign.sequence.followUps} follow-ups` : ""}`}
                />
                <Data
                  label="Delivery mode"
                  value="Administrator approval required"
                />
                <Data
                  label="Duplicate protection"
                  value="One invitation and one instance of each sequence step per approved advocate"
                />
                <Data label="Time zone" value={campaign.deliveryTimezone} />
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
              <p className="text-[0.54rem] uppercase tracking-[.15em] text-white/30">
                Initial invitation preview
              </p>
              <p className="mt-3 text-sm font-medium text-white/70">
                {campaign.invitationSubject}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/45">
                {campaign.invitationBody}
              </p>
            </div>
            {campaign.sequence.followUps > 0 && (
              <div className="mt-4 space-y-3">
                {Array.from(
                  { length: campaign.sequence.followUps },
                  (_, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5"
                    >
                      <p className="text-[0.54rem] uppercase tracking-[.15em] text-white/30">
                        Follow-up {index + 1} ·{" "}
                        {(campaign.followUpConfiguration.delayDays ?? 7) *
                          (index + 1)}{" "}
                        days after initial invitation
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/45">
                        {campaign.communicationTemplates.followUp ||
                          "Approved follow-up template"}
                      </p>
                    </div>
                  ),
                )}
              </div>
            )}
            <label className="mt-6 block text-[0.56rem] uppercase tracking-[.15em] text-white/35">
              Proposed first send
              <input
                autoFocus
                required
                type="datetime-local"
                value={firstSendAt}
                onChange={(event) => setFirstSendAt(event.target.value)}
                className="admin-input mt-2 w-full"
              />
            </label>
            <label className="mt-4 block text-[0.56rem] uppercase tracking-[.15em] text-white/35">
              Scheduling time zone
              <select
                required
                value={scheduleTimezone}
                onChange={(event) => setScheduleTimezone(event.target.value)}
                className="admin-input mt-2 w-full"
              >
                <option value="America/Denver">America/Denver</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">
                  America/Los_Angeles
                </option>
              </select>
            </label>
            <p className="mt-4 text-xs leading-5 text-amber-100/65">
              By confirming, you authorize creation of the future delivery
              schedule for {campaign.expectedAdvocateCount ?? 0} advocates. This
              does not send immediately.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="admin-btn-link"
              >
                Cancel and return
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void saveWithoutScheduling()}
                className="admin-btn-secondary"
              >
                {busy === "save-schedule-draft"
                  ? "Saving…"
                  : "Save without scheduling"}
              </button>
              <button
                disabled={busy === "schedule" || !firstSendAt}
                className="admin-btn-primary"
              >
                {busy === "schedule"
                  ? "Confirming…"
                  : campaign.operationalState === "SCHEDULED"
                    ? "Update Schedule"
                    : "Schedule Campaign"}
              </button>
            </div>
          </form>
        </div>
      )}
      {testOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setTestOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="referral-test-title"
            onSubmit={sendTest}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141412] p-6 shadow-2xl sm:p-7"
          >
            <p className="text-[0.56rem] uppercase tracking-[.18em] text-[var(--helios-orange)]">
              Test only
            </p>
            <h2
              id="referral-test-title"
              className="mt-3 text-2xl font-light text-white"
            >
              Send referral invitation test
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/40">
              No client recipient will receive this test. It does not change
              campaign analytics or referral status. The subject includes
              [TEST].
            </p>
            <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-[0.52rem] uppercase tracking-[.14em] text-white/25">
                Subject
              </p>
              <p className="mt-2 text-sm text-white/60">
                [TEST]{" "}
                {campaign.invitationSubject.replace(/^\\[TEST\\]\\s*/i, "")}
              </p>
            </div>
            <label className="mt-5 block text-[0.56rem] uppercase tracking-[.15em] text-white/35">
              Send test to
              <input
                autoFocus
                required
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                className="admin-input mt-2 w-full"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTestOpen(false)}
                className="admin-btn-link"
              >
                Cancel
              </button>
              <button disabled={busy === "test"} className="admin-btn-primary">
                {busy === "test" ? "Sending…" : "Send test"}
              </button>
            </div>
          </form>
        </div>
      )}
      <nav
        aria-label="Campaign sections"
        className="flex gap-1 overflow-x-auto border-b border-white/[0.08] pb-px"
      >
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`whitespace-nowrap border-b px-4 py-3 text-xs uppercase tracking-[.12em] transition ${tab === item ? "border-[var(--helios-orange)] text-white" : "border-transparent text-white/30 hover:text-white/60"}`}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "Overview" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_.7fr]">
          <Card title="Campaign direction">
            <Data label="Public title" value={campaign.publicTitle} />
            <Data label="Referral offer" value={campaign.referralOffer} />
            <Data label="Advocate reward" value={campaign.advocateReward} />
            <Data
              label="Referred-customer offer"
              value={campaign.referredCustomerOffer}
            />
            <Data label="Eligibility" value={campaign.eligibilityRules} />
            <Data label="Qualification" value={campaign.qualificationRules} />
          </Card>
          <div className="grid gap-5">
            <Metric label="Advocates" value={campaign.advocates.length} />
            <Metric label="Invitations" value={campaign._count.invitations} />
            <Metric label="Referrals" value={campaign._count.submissions} />
          </div>
        </div>
      )}
      {tab === "Audience" && (
        <Card title="Approved audience & recommendations">
          <p className="mb-5 text-sm leading-6 text-white/35">
            Recommendations are advisory. Inclusion happens only through the
            approved campaign snapshot.
          </p>
          <div className="divide-y divide-white/[0.06]">
            {campaign.advocates.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 py-4 md:grid-cols-[1fr_1.4fr_auto] md:items-center"
              >
                <div>
                  <p className="text-sm text-white/70">
                    {item.client.displayName}
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    {item.client.email}
                  </p>
                </div>
                <p className="text-xs leading-5 text-white/40">
                  {item.recommendationReason ||
                    "Included from the administrator-approved audience."}
                </p>
                <span className="text-xs text-white/35">
                  {item._count.submissions} referrals
                </span>
              </div>
            ))}
            {!campaign.advocates.length && (
              <p className="py-6 text-sm text-white/35">
                Advocate records are created only after the campaign is approved
                and launched.
              </p>
            )}
          </div>
        </Card>
      )}
      {tab === "Invitation" && (
        <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <Card title="Delivery">
            <Data
              label="Sender"
              value={[campaign.senderName, campaign.senderEmail]
                .filter(Boolean)
                .join(" · ")}
            />
            <Data label="Reply-to" value={campaign.replyTo || adminEmail} />
            <Data label="Subject" value={campaign.invitationSubject} />
            <Data label="Preview text" value={campaign.invitationPreviewText} />
          </Card>
          <Card title="Invitation preview">
            <p className="text-[0.56rem] uppercase tracking-[.18em] text-[var(--helios-orange)]">
              Helios Referral Studio
            </p>
            <h3 className="mt-4 font-serif text-2xl font-normal text-white">
              {campaign.publicTitle}
            </h3>
            <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/55">
              {campaign.invitationBody}
            </div>
            <button
              type="button"
              className="mt-6 bg-[#c85f28] px-5 py-3 text-xs font-semibold uppercase tracking-[.14em] text-white"
            >
              Share a referral
            </button>
          </Card>
        </div>
      )}
      {tab === "Landing Page" && (
        <Card title="Public referral experience">
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0d0d0c] p-7 sm:p-10">
            <p className="text-[0.56rem] uppercase tracking-[.18em] text-[var(--helios-orange)]">
              A Helios introduction
            </p>
            <h3 className="mt-4 font-serif text-3xl font-normal text-white">
              {campaign.landingHeadline}
            </h3>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/50">
              {campaign.landingBody}
            </p>
            <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.025] p-5 text-xs leading-6 text-white/35">
              {campaign.privacyNotice}
            </div>
          </div>
        </Card>
      )}
      {tab === "Pipeline" && (
        <Card title="Referral pipeline">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {campaign.submissions.map((item) => (
              <Link
                key={item.id}
                href={`/admin/referral-studio/referrals/${item.id}`}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-white/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-white/70">
                    {item.firstName} {item.lastName}
                  </p>
                  <span
                    className={`text-[0.5rem] uppercase tracking-[.12em] ${item.attributionStatus === "NEEDS_REVIEW" ? "text-amber-100" : "text-emerald-200"}`}
                  >
                    {item.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-3 text-xs text-white/30">
                  Advocate:{" "}
                  {item.advocate?.client.displayName || "Review attribution"}
                </p>
              </Link>
            ))}
            {!campaign.submissions.length && (
              <p className="text-sm text-white/35">
                No referrals have entered this campaign yet.
              </p>
            )}
          </div>
        </Card>
      )}
      {tab === "Approval" && (
        <Card title="Manual approval gate">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-3xl text-sm leading-6 text-white/40">
              Approval freezes the audience, exclusions, sender, reply-to,
              offer, reward terms, invitation, landing page, follow-up plan,
              dates, and templates into an immutable revision. Launch always
              uses that approved snapshot.
            </p>
            {campaign.status === "DRAFT" && (
              <Link
                href={`/admin/referral-studio/campaigns/${campaign.id}/edit`}
                className="admin-btn-secondary shrink-0"
              >
                Edit Campaign
              </Link>
            )}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Approved revision"
              value={
                campaign.approvedRevisionId
                  ? `#${campaign.revisions[0]?.revisionNumber ?? 1}`
                  : "Not approved"
              }
            />
            <Metric
              label="Eligible advocates"
              value={campaign.audienceEstimate.eligible.length}
            />
            <Metric
              label="Excluded"
              value={campaign.audienceEstimate.excluded.length}
            />
            <Metric
              label="Test send"
              value={
                campaign.auditEvents.some(
                  (event) => event.action === "TEST_SENT",
                )
                  ? "Completed"
                  : "Not completed"
              }
            />
          </div>
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl border border-white/[0.07] p-4">
              <Data
                label="Sender"
                value={[campaign.senderName, campaign.senderEmail]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Data label="Reply-to" value={campaign.replyTo} />
              <Data
                label="Invitation subject"
                value={campaign.invitationSubject}
              />
              <Data label="Referral offer" value={campaign.referralOffer} />
              <Data label="Advocate reward" value={campaign.advocateReward} />
            </div>
            <div className="rounded-xl border border-white/[0.07] p-4">
              <Data
                label="Campaign dates"
                value={`${campaign.startsAt ? new Date(campaign.startsAt).toLocaleString() : "Immediate"} → ${campaign.endsAt ? new Date(campaign.endsAt).toLocaleString() : "No fixed end"}`}
              />
              <Data label="Landing page" value={campaign.landingHeadline} />
              <Data label="Campaign terms" value={campaign.terms} />
              {campaign.audienceEstimate.excluded.length > 0 && (
                <div className="mt-4">
                  <p className="text-[0.54rem] uppercase tracking-[.15em] text-amber-100/60">
                    Exclusion reasons
                  </p>
                  <ul className="mt-2 space-y-2 text-xs text-amber-50/50">
                    {campaign.audienceEstimate.excluded
                      .slice(0, 20)
                      .map((item) => (
                        <li key={item.id}>
                          {item.displayName}: {item.reasons.join(", ")}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          {campaign.status === "DRAFT" && (
            <button
              onClick={() => action("approve")}
              disabled={!!busy || !campaign.audienceEstimate.eligible.length}
              className="admin-btn-primary mt-6"
            >
              {busy === "approve" ? "Approving…" : "Approve immutable snapshot"}
            </button>
          )}
        </Card>
      )}
      {tab === "History" && (
        <Card title="Campaign audit history">
          <div className="divide-y divide-white/[0.06]">
            {campaign.auditEvents.map((event) => (
              <div key={event.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[.12em] text-white/45">
                    {event.action.replaceAll("_", " ")}
                  </p>
                  <time className="text-xs text-white/25">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 text-sm text-white/55">{event.summary}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7">
      <h2 className="text-2xl font-light text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function Data({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-white/[0.06] py-4 first:pt-0 last:border-0">
      <p className="text-[0.54rem] font-semibold uppercase tracking-[.16em] text-white/25">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/60">
        {value || "Not configured"}
      </p>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[0.52rem] uppercase tracking-[.15em] text-white/25">
        {label}
      </p>
      <p className="mt-2 text-xl font-light text-white">{value}</p>
    </div>
  );
}
