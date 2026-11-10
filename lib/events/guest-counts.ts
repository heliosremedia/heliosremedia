/** Additional people accompanying the invited client, excluding the client. */
export const MAX_ADDITIONAL_GUESTS = 99;
export type RsvpResponse = "YES" | "NO" | "MAYBE";

export function isAdditionalGuestCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_ADDITIONAL_GUESTS;
}

export function resolveAdditionalGuests(response: RsvpResponse, submitted: unknown, existing = 0): number {
  if (submitted !== undefined && !isAdditionalGuestCount(submitted)) {
    throw new Error(`Enter a whole number of additional guests from 0 to ${MAX_ADDITIONAL_GUESTS}.`);
  }
  if (response === "NO") return 0;
  // Older RSVP pages omit the field. Preserve the latest stored count rather
  // than silently clearing it when those pages change Yes to Maybe or back.
  return submitted === undefined ? existing : submitted as number;
}
