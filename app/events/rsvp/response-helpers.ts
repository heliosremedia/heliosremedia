import { isAdditionalGuestCount, MAX_ADDITIONAL_GUESTS } from "../../../lib/events/guest-counts.ts";

export { MAX_ADDITIONAL_GUESTS };
export const RSVP_RESPONSES = ["YES", "NO", "MAYBE"] as const;
export type RsvpChoice = typeof RSVP_RESPONSES[number];

export function normalizeRsvpChoice(value: unknown): RsvpChoice | "" {
  return RSVP_RESPONSES.includes(value as RsvpChoice) ? value as RsvpChoice : "";
}

export function readRsvpFragment(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return { token: params.get("token") || "", choice: normalizeRsvpChoice(params.get("response")) };
}

export function initialRsvpChoice(requested: unknown, current: unknown): RsvpChoice | "" {
  return normalizeRsvpChoice(requested) || normalizeRsvpChoice(current);
}

export function initialAdditionalGuests(response: unknown, value: unknown): string {
  return (response === "YES" || response === "MAYBE") && isAdditionalGuestCount(value) ? String(value) : "0";
}

export function parseAdditionalGuests(response: RsvpChoice | "", value: string): number | null {
  if (response === "NO") return 0;
  if ((response !== "YES" && response !== "MAYBE") || !/^\d+$/.test(value)) return null;
  const count = Number(value);
  return isAdditionalGuestCount(count) ? count : null;
}

export function rsvpPartySummary(response: unknown, value: unknown): string {
  if (response !== "YES" && response !== "MAYBE") return "";
  const extra = Number(initialAdditionalGuests(response, value));
  const party = extra + 1;
  return `${response === "MAYBE" ? "Tentative party" : "Your party"}: ${party} ${party === 1 ? "person (just you)" : `people (you + ${extra} ${extra === 1 ? "guest" : "guests"})`}.`;
}
