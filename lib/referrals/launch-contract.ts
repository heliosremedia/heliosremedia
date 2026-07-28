export const REFERRAL_LAUNCH_BATCH_SIZE = 20;
export const REFERRAL_STALE_LAUNCH_MS = 15 * 60_000;

export function referralLaunchIsStalled(input: {
  status: string;
  launchStartedAt: Date | string | null;
  launchLeaseExpiresAt: Date | string | null;
  lastProgressAt?: Date | string | null;
  preparedAdvocateCount: number;
  now?: Date;
}) {
  if (input.status !== "LAUNCHING" || !input.launchStartedAt) return false;
  const now = input.now?.getTime() ?? Date.now();
  const started = new Date(input.launchStartedAt).getTime();
  const lastProgress = input.lastProgressAt ? new Date(input.lastProgressAt).getTime() : started;
  const leaseExpired = !input.launchLeaseExpiresAt || new Date(input.launchLeaseExpiresAt).getTime() < now;
  return leaseExpired && now - Math.max(started, lastProgress) >= REFERRAL_STALE_LAUNCH_MS;
}

export function referralRecoveryMode(input: {
  status: string;
  sentCount: number;
  preparedCommunicationCount: number;
}) {
  if (input.status !== "LAUNCHING") return "UNAVAILABLE" as const;
  if (input.sentCount > 0) return "PARTIAL_DELIVERY" as const;
  return input.preparedCommunicationCount > 0 ? "PARTIAL_PREPARATION" as const : "ZERO_DELIVERY" as const;
}

export function referralLaunchBatches<T>(items: T[], batchSize = REFERRAL_LAUNCH_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error("Invalid referral launch batch size.");
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) batches.push(items.slice(index, index + batchSize));
  return batches;
}

export function referralCommunicationIdempotencyKey(invitationId: string, followUpNumber = 0) {
  return followUpNumber > 0
    ? `referral:${invitationId}:follow-up:${followUpNumber}`
    : `referral:${invitationId}:invitation`;
}

export function referralLaunchIsComplete(input: {
  expectedAdvocates: number;
  preparedInvitations: number;
  preparedCommunications: number;
  followUpCount: number;
}) {
  return input.preparedInvitations === input.expectedAdvocates
    && input.preparedCommunications === input.expectedAdvocates * (1 + input.followUpCount);
}

export function referralLaunchClaimMode(status: string, failed: boolean) {
  if (status === "APPROVED") return "INITIAL" as const;
  if (status === "LAUNCHING" && failed) return "RETRY" as const;
  if (status === "LAUNCHING") return "IN_PROGRESS" as const;
  return "REJECTED" as const;
}

export function missingReferralRecipients<T extends { id: string }>(audience: T[], completedClientIds: Iterable<string>) {
  const completed = new Set(completedClientIds);
  return audience.filter(recipient => !completed.has(recipient.id));
}
