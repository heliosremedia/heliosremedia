export type AttributionCandidate = {
  campaignId: string;
  advocateId: string | null;
  expired: boolean;
  selfReferral: boolean;
  existingClient: boolean;
  duplicateSubmissionId?: string | null;
  competingAdvocateIds?: string[];
};

export function resolveAttribution(input: AttributionCandidate) {
  const reasons: string[] = [];
  if (!input.advocateId) reasons.push("No advocate could be confirmed");
  if (input.expired) reasons.push("Referral link or campaign expired");
  if (input.selfReferral) reasons.push("Potential self-referral");
  if (input.existingClient) reasons.push("Referred person matches an existing client");
  if (input.duplicateSubmissionId) reasons.push("Potential duplicate submission");
  if ((input.competingAdvocateIds?.length ?? 0) > 1) reasons.push("Multiple advocates may claim this referral");
  return reasons.length
    ? { status: "NEEDS_REVIEW" as const, referralStatus: "NEEDS_REVIEW" as const, reasons }
    : { status: "CONFIRMED" as const, referralStatus: "SUBMITTED" as const, reasons };
}

export function normalizedPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 7 ? digits.slice(-15) : null;
}
