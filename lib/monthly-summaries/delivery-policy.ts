// Applies only after a single provider request. Never classify a retry chain from its last error.
export function failureStatus(error: { code?: string; provider?: { status: number | null; providerType: string | null } | null } | null) {
  const definite = error && (
    error.code === "EMAIL_PROVIDER_NOT_CONFIGURED" ||
    (error.code === "EMAIL_PROVIDER_SENDER" && !error.provider) ||
    ([400, 401, 403, 422, 429].includes(error.provider?.status || 0) && !String(error.provider?.providerType).includes("idempoten"))
  );
  return definite ? "FAILED" : "UNCERTAIN";
}

export function deliveryEnabled(environment: { MONTHLY_SUMMARIES_LIVE_ENABLED?: string; MONTHLY_SUMMARIES_DATA_APPROVED?: string }) {
  return environment.MONTHLY_SUMMARIES_LIVE_ENABLED === "true" && environment.MONTHLY_SUMMARIES_DATA_APPROVED === "true";
}

export type DeliveryKind = "TEST" | "LIVE" | "MANUAL" | "RESEND";
export function liveConfigurationApproved(env: { [key: string]: string | undefined }) {
  return Boolean(env.HDPH_V3_TOKEN?.trim()) && deliveryEnabled(env);
}
export function deliveryRequestKey(kind: DeliveryKind, reportId: string, hash: string, requestId: string) {
  return kind === "LIVE" || kind === "MANUAL" ? `monthly/${reportId}/${hash}` : `monthly-${kind.toLowerCase()}/${reportId}/${requestId}`;
}
export function requireDeliveryWindow(kind: DeliveryKind, automationEnabled: boolean, generationUntil: Date | null, now = new Date()) {
  if (kind === "TEST") return;
  if (kind === "LIVE" && !automationEnabled) throw new Error("Automation is paused.");
  if (generationUntil && generationUntil > now) throw new Error("Generation is still running.");
}
