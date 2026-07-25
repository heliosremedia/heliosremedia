const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ReferralValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ReferralValidationError";
  }
}

export function text(value: unknown, max: number, options?: { required?: boolean }) {
  const result = typeof value === "string" ? value.trim() : "";
  if (options?.required && !result) throw new ReferralValidationError("REQUIRED", "Complete all required fields.");
  if (result.length > max) throw new ReferralValidationError("TOO_LONG", "One or more fields exceed the allowed length.");
  return result;
}

export function email(value: unknown) {
  const result = text(value, 320, { required: true }).toLowerCase();
  if (!EMAIL.test(result)) throw new ReferralValidationError("INVALID_EMAIL", "Enter a valid email address.");
  return result;
}

export function stringArray(value: unknown, max = 1_000) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length <= 200))].slice(0, max);
}

export function optionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new ReferralValidationError("INVALID_DATE", "Choose a valid date.");
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new ReferralValidationError("INVALID_DATE", "Choose a valid date.");
  return result;
}

export function integer(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
