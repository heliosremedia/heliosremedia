import { createHash } from "node:crypto";

export function publishingIdempotencyKey(variantId: string, connectionId: string, contentVersion: number, scheduledAt: Date) {
  return createHash("sha256").update(JSON.stringify({ variantId, connectionId, contentVersion, scheduledAt: scheduledAt.toISOString() })).digest("hex");
}

export function retryDelayMs(attempt: number, random = Math.random()) {
  const base = Math.min(60 * 60_000, 30_000 * (2 ** Math.max(0, attempt - 1)));
  return Math.round(base * (0.75 + random * 0.5));
}

export function sanitizeProviderMessage(message: string) {
  return message.replace(/(?:access|refresh)[_-]?token\s*[:=]\s*\S+/gi, "[redacted]").slice(0, 500);
}

