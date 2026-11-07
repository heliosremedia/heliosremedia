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
