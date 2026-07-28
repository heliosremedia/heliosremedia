export type ReferralOperationalState =
  | "DRAFT" | "APPROVED_NOT_SCHEDULED" | "PREPARING" | "SCHEDULED"
  | "SENDING" | "ACTIVE" | "PAUSED" | "STALLED" | "COMPLETED"
  | "CANCELLED" | "ARCHIVED";

export function referralOperationalState(input: {
  status: string;
  scheduleConfirmedAt?: Date | string | null;
  deliveryScheduledAt?: Date | string | null;
  sentCount: number;
  sendingCount?: number;
  stalled?: boolean;
  timezone?: string | null;
  approvedRevisionId?: string | null;
  scheduledRevisionId?: string | null;
  scheduledAudienceCount?: number | null;
}): ReferralOperationalState {
  if (input.status === "DRAFT") return "DRAFT";
  if (input.status === "CANCELLED") return "CANCELLED";
  if (input.status === "ARCHIVED") return "ARCHIVED";
  if (input.status === "COMPLETED" || input.status === "EXPIRED") return "COMPLETED";
  if (input.status === "PAUSED") return "PAUSED";
  if (input.stalled) return "STALLED";
  if (input.status === "LAUNCHING") return "PREPARING";
  if ((input.sendingCount ?? 0) > 0) return "SENDING";
  if (input.sentCount > 0) return "ACTIVE";
  if (
    input.scheduleConfirmedAt
    && input.deliveryScheduledAt
    && input.timezone
    && input.approvedRevisionId
    && input.scheduledRevisionId === input.approvedRevisionId
    && (input.scheduledAudienceCount ?? 0) > 0
    && new Date(input.deliveryScheduledAt) > new Date()
  ) return "SCHEDULED";
  return "APPROVED_NOT_SCHEDULED";
}

export function referralOperationalLabel(state: ReferralOperationalState) {
  const labels: Record<ReferralOperationalState, string> = {
    DRAFT: "Draft",
    APPROVED_NOT_SCHEDULED: "Approved — Not Scheduled",
    PREPARING: "Preparing",
    SCHEDULED: "Scheduled",
    SENDING: "Sending",
    ACTIVE: "Active",
    PAUSED: "Paused",
    STALLED: "Stalled",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    ARCHIVED: "Archived",
  };
  return labels[state];
}

export function referralSequenceSummary(input: {
  advocateCount: number;
  followUpEnabled: boolean;
  followUpCount: number;
}) {
  const followUps = input.followUpEnabled ? Math.max(0, Math.min(3, input.followUpCount)) : 0;
  return {
    steps: 1 + followUps,
    followUps,
    estimatedMessages: input.advocateCount * (1 + followUps),
  };
}

export function referralScheduleIsRunnable(input: {
  campaignStatus: string;
  scheduleConfirmedAt?: Date | string | null;
  deliveryScheduledAt?: Date | string | null;
  now: Date;
  timezone?: string | null;
  approvedRevisionId?: string | null;
  scheduledRevisionId?: string | null;
  scheduledAudienceCount?: number | null;
}) {
  if (
    !input.scheduleConfirmedAt || !input.deliveryScheduledAt || !input.timezone
    || !input.approvedRevisionId || input.scheduledRevisionId !== input.approvedRevisionId
    || (input.scheduledAudienceCount ?? 0) < 1
  ) return false;
  return ["APPROVED", "ACTIVE"].includes(input.campaignStatus)
    && new Date(input.deliveryScheduledAt) <= input.now;
}
