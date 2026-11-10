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
