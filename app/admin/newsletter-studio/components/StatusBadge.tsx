import type { NewsletterStatus } from "../types";

const labels: Record<NewsletterStatus, string> = {
  AWAITING_GENERATION: "Awaiting Generation", GENERATING: "Generating",
  DRAFT_GENERATED: "Draft Generated", NEEDS_REVIEW: "Needs Review", APPROVED: "Approved",
  SCHEDULED: "Scheduled", SENDING: "Sending", SENT: "Sent", PAUSED: "Paused",
  MISSED_APPROVAL: "Missed Approval", GENERATION_FAILED: "Generation Failed",
  SEND_FAILED: "Send Failed", PARTIALLY_SENT: "Partially Sent", CANCELLED: "Cancelled",
};

export default function StatusBadge({ status }: { status: NewsletterStatus }) {
  const tone = status === "SENT" || status === "APPROVED"
    ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200"
    : status === "NEEDS_REVIEW" || status === "MISSED_APPROVAL"
      ? "border-amber-300/20 bg-amber-300/[0.07] text-amber-100"
      : status.includes("FAILED") || status === "PARTIALLY_SENT"
        ? "border-red-300/20 bg-red-300/[0.07] text-red-100"
        : "border-white/10 bg-white/[0.04] text-white/50";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.12em] ${tone}`}>{labels[status]}</span>;
}
