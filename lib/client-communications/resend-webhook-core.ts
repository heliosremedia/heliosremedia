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
