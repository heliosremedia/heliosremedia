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
  return typeof type === "string" && Object.hasOwn(RESEND_EVENT_STATUS, type)
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


type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: unknown;
    click?: { link?: string };
    bounce?: { type?: string; subtype?: string; message?: string };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): value is string | null | undefined {
  return value == null || typeof value === "string";
}

// Validate the fields consumed by processing; unrelated provider additions are allowed.
export function parseResendEvent(value: unknown):
  | { kind: "invalid" }
  | { kind: "ignored" }
  | { kind: "supported"; event: ResendEvent; normalizedStatus: NonNullable<ReturnType<typeof normalizedResendStatus>> } {
  if (!isRecord(value) || typeof value.type !== "string") return { kind: "invalid" };
  const normalizedStatus = normalizedResendStatus(value.type);
  if (!normalizedStatus) return { kind: "ignored" };
  if (!optionalString(value.created_at)) return { kind: "invalid" };
  if (value.data != null && !isRecord(value.data)) return { kind: "invalid" };
  const data = value.data ?? {};
  if (!optionalString(data.email_id)) return { kind: "invalid" };
  if (data.click != null && !isRecord(data.click)) return { kind: "invalid" };
  if (data.bounce != null && !isRecord(data.bounce)) return { kind: "invalid" };
  const click = data.click ?? {};
  const bounce = data.bounce ?? {};
  if (!optionalString(click.link) || !optionalString(bounce.type) ||
      !optionalString(bounce.subtype) || !optionalString(bounce.message)) return { kind: "invalid" };
  return {
    kind: "supported", normalizedStatus,
    event: {
      type: value.type, created_at: value.created_at ?? undefined,
      data: {
        email_id: data.email_id ?? undefined, to: data.to,
        click: { link: click.link ?? undefined },
        bounce: { type: bounce.type ?? undefined, subtype: bounce.subtype ?? undefined, message: bounce.message ?? undefined },
      },
    },
  };
}
