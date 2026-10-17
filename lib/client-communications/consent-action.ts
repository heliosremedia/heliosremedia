/** Unknown company consent needs explicit proof; legacy UNKNOWN retains its established action. */
export function consentActionForStatus(status: string, companyConsent: boolean) {
  return ["UNSUBSCRIBED", "SUPPRESSED"].includes(status) || (companyConsent && ["UNKNOWN", "PENDING_CONFIRMATION"].includes(status)) ? "resubscribe" : "unsubscribe";
}
