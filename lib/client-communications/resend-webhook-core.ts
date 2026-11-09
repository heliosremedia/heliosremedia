export const RESEND_EVENT_STATUS = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DELAYED",
  "email.bounced": "BOUNCED",
  "email.failed": "FAILED",
  "email.suppressed": "SUPPRESSED",
  "email.complained": "COMPLAINED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
} as const;

export type SupportedResendEvent = keyof typeof RESEND_EVENT_STATUS;

export function normalizedResendStatus(type: unknown) {
  return typeof type === "string"
    ? RESEND_EVENT_STATUS[type as SupportedResendEvent] ?? null
    : null;
}

export function safeEventDate(value: unknown, fallback = new Date()) {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function diagnosticEmails(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return [...new Set(values.map((item) => typeof item === "string" ? item.trim().toLowerCase() : "")
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))];
}

export const UNMATCHED_WEBHOOK_GRACE_MS = 10 * 60_000;
export function unmatchedWebhookRetry(firstReceivedAt: Date, now = new Date()) {
  const age = +now - +firstReceivedAt;
  return Number.isFinite(age) && age >= 0 && age < UNMATCHED_WEBHOOK_GRACE_MS;
}
/** A proven ownership ambiguity/mismatch cannot be fixed by provider redelivery. */
export class PermanentWebhookError extends Error {
  constructor(message: string) { super(message); this.name = "PermanentWebhookError"; }
}
