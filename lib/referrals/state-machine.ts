export const REFERRAL_STATUSES = [
  "INVITED", "VISITED", "SUBMITTED", "CONTACTED", "QUALIFIED", "BOOKED", "COMPLETED",
  "REWARD_ELIGIBLE", "REWARD_ISSUED", "DISQUALIFIED", "DECLINED", "EXPIRED",
  "DUPLICATE", "CANCELLED", "NEEDS_REVIEW",
] as const;

export type ReferralStatusName = typeof REFERRAL_STATUSES[number];

const transitions: Record<ReferralStatusName, ReadonlySet<ReferralStatusName>> = {
  INVITED: new Set(["VISITED", "SUBMITTED", "EXPIRED", "DECLINED", "CANCELLED"]),
  VISITED: new Set(["SUBMITTED", "EXPIRED", "DECLINED", "CANCELLED"]),
  SUBMITTED: new Set(["CONTACTED", "QUALIFIED", "DISQUALIFIED", "DUPLICATE", "NEEDS_REVIEW", "CANCELLED"]),
  CONTACTED: new Set(["QUALIFIED", "DISQUALIFIED", "DECLINED", "NEEDS_REVIEW", "CANCELLED"]),
  QUALIFIED: new Set(["BOOKED", "DISQUALIFIED", "DECLINED", "NEEDS_REVIEW", "CANCELLED"]),
  BOOKED: new Set(["COMPLETED", "DISQUALIFIED", "CANCELLED"]),
  COMPLETED: new Set(["REWARD_ELIGIBLE", "CANCELLED"]),
  REWARD_ELIGIBLE: new Set(["REWARD_ISSUED", "DISQUALIFIED", "CANCELLED"]),
  REWARD_ISSUED: new Set(),
  DISQUALIFIED: new Set(["NEEDS_REVIEW"]),
  DECLINED: new Set(["CONTACTED", "CANCELLED"]),
  EXPIRED: new Set(["SUBMITTED", "CANCELLED"]),
  DUPLICATE: new Set(["NEEDS_REVIEW"]),
  CANCELLED: new Set(),
  NEEDS_REVIEW: new Set(["SUBMITTED", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "DUPLICATE", "CANCELLED"]),
};

export function canTransitionReferral(from: ReferralStatusName, to: ReferralStatusName) {
  return from === to || transitions[from].has(to);
}

export function assertReferralTransition(from: ReferralStatusName, to: ReferralStatusName) {
  if (!canTransitionReferral(from, to)) throw new Error(`Referral cannot move from ${from} to ${to}.`);
}

export function mayEditReferralCampaign(status: string) {
  return status === "DRAFT";
}

export function campaignDraftUpdateIssue(status: string, currentVersion: number, expectedVersion: number) {
  if (!mayEditReferralCampaign(status)) return "STATUS";
  if (currentVersion !== expectedVersion) return "STALE";
  return null;
}

export function campaignCanExecute(status: string, now: Date, startsAt?: Date | null, endsAt?: Date | null) {
  return status === "ACTIVE" && (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
}

export function invitationCanExecute(campaignStatus: string, invitationStatus: string, now: Date, scheduledAt?: Date | null) {
  return campaignStatus === "ACTIVE"
    && (invitationStatus === "APPROVED" || invitationStatus === "SCHEDULED")
    && (!scheduledAt || scheduledAt <= now);
}

export function followUpShouldStop(input: {
  campaignStatus: string;
  campaignEndsAt?: Date | null;
  invitationStatus: string;
  submissionExists: boolean;
  stoppedAt?: Date | null;
  now: Date;
}) {
  return input.campaignStatus !== "ACTIVE"
    || Boolean(input.campaignEndsAt && input.campaignEndsAt < input.now)
    || input.submissionExists
    || Boolean(input.stoppedAt)
    || ["FAILED", "UNSUBSCRIBED", "CANCELLED"].includes(input.invitationStatus);
}
