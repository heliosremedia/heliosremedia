import AdminStatusBadge from "@/app/admin/components/AdminStatusBadge";
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
    ? "success"
    : status === "NEEDS_REVIEW" || status === "MISSED_APPROVAL"
      ? "warning"
      : status.includes("FAILED") || status === "PARTIALLY_SENT"
        ? "error"
        : "neutral";
  return <AdminStatusBadge tone={tone}>{labels[status]}</AdminStatusBadge>;
}
