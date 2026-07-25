import type { NewsletterEditionStatus } from "./types";

const transitions: Record<NewsletterEditionStatus, readonly NewsletterEditionStatus[]> = {
  AWAITING_GENERATION: ["GENERATING", "PAUSED", "CANCELLED"],
  GENERATING: ["DRAFT_GENERATED", "GENERATION_FAILED"],
  DRAFT_GENERATED: ["NEEDS_REVIEW", "GENERATING", "CANCELLED"],
  NEEDS_REVIEW: ["GENERATING", "APPROVED", "PAUSED", "MISSED_APPROVAL", "CANCELLED"],
  APPROVED: ["SCHEDULED", "NEEDS_REVIEW", "CANCELLED"],
  SCHEDULED: ["SENDING", "NEEDS_REVIEW", "MISSED_APPROVAL", "CANCELLED"],
  SENDING: ["SENT", "PARTIALLY_SENT", "SEND_FAILED"],
  SENT: [],
  PAUSED: ["AWAITING_GENERATION", "NEEDS_REVIEW", "CANCELLED"],
  MISSED_APPROVAL: ["NEEDS_REVIEW", "CANCELLED"],
  GENERATION_FAILED: ["GENERATING", "PAUSED", "CANCELLED"],
  SEND_FAILED: ["SCHEDULED", "NEEDS_REVIEW", "CANCELLED"],
  PARTIALLY_SENT: [],
  CANCELLED: [],
};

export function canTransitionEdition(from: NewsletterEditionStatus, to: NewsletterEditionStatus) {
  return transitions[from].includes(to);
}

export function assertEditionTransition(from: NewsletterEditionStatus, to: NewsletterEditionStatus) {
  if (!canTransitionEdition(from, to)) {
    throw new Error(`Invalid newsletter edition transition: ${from} -> ${to}`);
  }
}

export function statusAfterApprovedEditionMutation(input: {
  status: NewsletterEditionStatus;
  contentChanged?: boolean;
  recipientsChanged?: boolean;
  significantScheduleChanged?: boolean;
}) {
  const requiresReapproval =
    input.contentChanged || input.recipientsChanged || input.significantScheduleChanged;
  return requiresReapproval && (input.status === "APPROVED" || input.status === "SCHEDULED")
    ? "NEEDS_REVIEW" as const
    : input.status;
}

export function mayApprove(status: NewsletterEditionStatus) {
  return status === "NEEDS_REVIEW";
}

export function maySchedule(status: NewsletterEditionStatus, hasActiveApproval: boolean) {
  return status === "APPROVED" && hasActiveApproval;
}

export function maySend(status: NewsletterEditionStatus, hasActiveApproval: boolean) {
  return status === "SCHEDULED" && hasActiveApproval;
}
