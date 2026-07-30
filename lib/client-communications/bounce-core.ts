export const BOUNCED_BACK_GROUP_NAME = "Bounced Back";
export const BOUNCED_BACK_SYSTEM_PREFIX = "BOUNCED_BACK:";

export function normalizeBounceEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function bouncedBackSystemKey(workspaceId: string) {
  const id = workspaceId.trim();
  if (!id) throw new Error("A workspace ID is required.");
  return `${BOUNCED_BACK_SYSTEM_PREFIX}${id}`;
}

export function bouncedBackNormalizedGroupName(workspaceId: string) {
  return `bounced back:${workspaceId.trim().toLowerCase()}`;
}

export function isBouncedBackSystemKey(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(BOUNCED_BACK_SYSTEM_PREFIX) &&
    value.length > BOUNCED_BACK_SYSTEM_PREFIX.length;
}

export function sanitizeBounceReason(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const safe = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return safe ? safe.slice(0, Math.max(1, Math.min(maxLength, 500))) : null;
}

export function providerRecipientMatches(value: unknown, expectedEmail: string) {
  const expected = normalizeBounceEmail(expectedEmail);
  if (!expected) return false;
  const recipients = Array.isArray(value) ? value : [value];
  return recipients.some((recipient) => normalizeBounceEmail(recipient) === expected);
}
