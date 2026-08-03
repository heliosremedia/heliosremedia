import { createHash } from "node:crypto";

export const RESEND_BATCH_LIMIT = 100;
export const RESEND_TIMEOUT_MS = 15_000;

export type EmailProviderErrorCode =
  | "EMAIL_PROVIDER_NOT_CONFIGURED"
  | "EMAIL_PROVIDER_AUTHENTICATION"
  | "EMAIL_PROVIDER_PERMISSION"
  | "EMAIL_PROVIDER_SENDER"
  | "EMAIL_PROVIDER_RATE_LIMIT"
  | "EMAIL_PROVIDER_VALIDATION"
  | "EMAIL_PROVIDER_TRANSIENT"
  | "EMAIL_PROVIDER_REJECTED"
  | "EMAIL_PROVIDER_UNKNOWN";

export type NormalizedProviderError = {
  code: EmailProviderErrorCode;
  message: string;
  status: number | null;
  providerType: string | null;
  providerRequestId: string | null;
  retryable: boolean;
};

export type DeliveryEnvironment = {
  RESEND_API_KEY?: string;
  CAMPAIGN_EMAIL_FROM?: string;
  PORTAL_EMAIL_FROM?: string;
  CAMPAIGN_REPLY_TO?: string;
};

export function resolveDeliveryConfig(environment: DeliveryEnvironment) {
  const apiKey = environment.RESEND_API_KEY?.trim() || null;
  const from = environment.CAMPAIGN_EMAIL_FROM?.trim() ||
    environment.PORTAL_EMAIL_FROM?.trim() || null;
  const replyTo = environment.CAMPAIGN_REPLY_TO?.trim() || null;
  const mailbox = (value: string) => value.match(/<([^>]+)>/)?.[1] || value;
  const validAddress = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox(value).trim());
  return {
    apiKey,
    from,
    replyTo,
    configured: Boolean(apiKey && from),
    senderValid: Boolean(from && validAddress(from) && (!replyTo || validAddress(replyTo))),
  };
}

type ProviderErrorLike = {
  name?: unknown;
  message?: unknown;
  statusCode?: unknown;
};

export function normalizeResendError(
  value: unknown,
  headers?: Record<string, string> | null,
): NormalizedProviderError {
  const error = value && typeof value === "object" ? value as ProviderErrorLike : {};
  const providerType = typeof error.name === "string" ? error.name : null;
  const status = typeof error.statusCode === "number" ? error.statusCode : null;
  const rawMessage = typeof error.message === "string" ? error.message : "Unknown provider response";
  const message = rawMessage.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  const normalized = `${providerType ?? ""} ${message}`.toLowerCase();
  const providerRequestId = headers?.["x-request-id"] || headers?.["request-id"] ||
    headers?.["cf-ray"] || null;

  if (providerType === "missing_api_key" || providerType === "invalid_api_key" || status === 401) {
    return { code: "EMAIL_PROVIDER_AUTHENTICATION", message, status, providerType, providerRequestId, retryable: false };
  }
  if (providerType === "invalid_from_address" ||
      normalized.includes("sender") || normalized.includes("sending domain") ||
      normalized.includes("from address") || normalized.includes("domain is not verified")) {
    return { code: "EMAIL_PROVIDER_SENDER", message, status, providerType, providerRequestId, retryable: false };
  }
  if (providerType === "restricted_api_key" || providerType === "invalid_access" ||
      providerType === "security_error" || status === 403) {
    return { code: "EMAIL_PROVIDER_PERMISSION", message, status, providerType, providerRequestId, retryable: false };
  }
  if (providerType === "rate_limit_exceeded" || status === 429) {
    return { code: "EMAIL_PROVIDER_RATE_LIMIT", message, status, providerType, providerRequestId, retryable: true };
  }
  if (["validation_error", "invalid_parameter", "missing_required_field", "invalid_attachment",
    "invalid_idempotency_key", "invalid_idempotent_request"].includes(providerType ?? "") ||
    status === 400 || status === 422) {
    return { code: "EMAIL_PROVIDER_VALIDATION", message, status, providerType, providerRequestId, retryable: false };
  }
  if (providerType === "concurrent_idempotent_requests" || providerType === "application_error" ||
      providerType === "internal_server_error" || status === null || (status >= 500 && status <= 599)) {
    return { code: "EMAIL_PROVIDER_TRANSIENT", message, status, providerType, providerRequestId, retryable: true };
  }
  if (status !== null) {
    return { code: "EMAIL_PROVIDER_REJECTED", message, status, providerType, providerRequestId, retryable: false };
  }
  return { code: "EMAIL_PROVIDER_UNKNOWN", message, status, providerType, providerRequestId, retryable: false };
}

export function providerAdminMessage(code: EmailProviderErrorCode) {
  switch (code) {
    case "EMAIL_PROVIDER_AUTHENTICATION":
    case "EMAIL_PROVIDER_PERMISSION":
      return "The email provider rejected the request. Delivery credentials or account permissions need attention.";
    case "EMAIL_PROVIDER_SENDER":
      return "The configured sender address is not accepted by the email provider. Verify the sending domain and From address.";
    case "EMAIL_PROVIDER_RATE_LIMIT":
    case "EMAIL_PROVIDER_TRANSIENT":
      return "The email provider is temporarily unavailable. No duplicate emails were created. Delivery can be retried safely.";
    case "EMAIL_PROVIDER_NOT_CONFIGURED":
      return "Email delivery is not configured.";
    default:
      return "The email provider rejected this send. Review the delivery details and retry after the configuration is corrected.";
  }
}

export function chunkMessages<T>(messages: readonly T[], size = RESEND_BATCH_LIMIT) {
  const chunks: T[][] = [];
  for (let index = 0; index < messages.length; index += size) {
    chunks.push(messages.slice(index, index + size));
  }
  return chunks;
}

export function resendTagValue(value: string) {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 256);
  return sanitized || createHash("sha256").update(value).digest("hex");
}

export function deliveryContentHash(messages: Array<{
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
}>) {
  return createHash("sha256").update(JSON.stringify(messages.map((message) => ({
    to: message.to.trim().toLowerCase(),
    subject: message.subject,
    html: message.html,
    unsubscribeUrl: message.unsubscribeUrl ?? null,
  })))).digest("hex");
}

export function batchIdempotencyKey(input: {
  campaignId: string;
  revisionKey: string;
  batchNumber: number;
  messages: Array<{ to: string }>;
}) {
  const recipientSet = createHash("sha256")
    .update(input.messages.map((message) => message.to.trim().toLowerCase()).sort().join("\n"))
    .digest("hex");
  return `helios/${createHash("sha256").update([
    input.campaignId,
    input.revisionKey,
    String(input.batchNumber),
    recipientSet,
  ].join(":")).digest("hex")}`;
}
