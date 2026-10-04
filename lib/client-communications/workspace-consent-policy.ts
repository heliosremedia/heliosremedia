/** A legacy subscription never grants consent to a newly provisioned company. */
export function workspaceMarketingEligibility(input: { companyStatus?: string | null; legacyStatus?: string | null; safetySuppressed: boolean }) {
  if (input.safetySuppressed || ["UNSUBSCRIBED", "SUPPRESSED"].includes(input.legacyStatus || "")) {
    return { eligible: false, reason: "PROTECTED_BLOCK" as const };
  }
  if (input.companyStatus !== "SUBSCRIBED") return { eligible: false, reason: "COMPANY_CONSENT_REQUIRED" as const };
  return { eligible: true, reason: null };
}
