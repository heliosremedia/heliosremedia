import type { EventEmailStage } from "./themes.ts";

export const EVENT_AI_STAGES = ["INITIAL", "FOLLOW_UP", "REMINDER"] as const;
export const EVENT_AI_TONES = ["Warm and welcoming", "Polished and professional", "Casual and friendly", "Festive and upbeat"] as const;
export type EventAITone = typeof EVENT_AI_TONES[number];
export type EventAIDraft = Record<EventEmailStage, { subject: string; body: string }>;
export type EventAISource = {
  title: string; description: string; startsAt: string | null; endsAt: string | null;
  timeZone: string; location: string; venueUrl: string; tone: EventAITone;
};
export type EventAIErrorCode = "input" | "config" | "rate" | "unavailable" | "timeout" | "provider";
const errors: Record<EventAIErrorCode, { status: number; message: string }> = {
  input: { status: 400, message: "Check the event details and tone, then try again." },
  config: { status: 503, message: "AI writing is not configured yet. Your email copy is unchanged." },
  rate: { status: 429, message: "You can generate five sets of emails every ten minutes. Please wait before trying again." },
  unavailable: { status: 503, message: "AI writing is temporarily unavailable. Your email copy is unchanged." },
  timeout: { status: 504, message: "AI writing took too long. Your email copy is unchanged. Please try again." },
  provider: { status: 502, message: "AI writing could not create a complete set of emails. Your email copy is unchanged. Please try again." },
};
export class EventAIError extends Error {
  readonly status: number;
  readonly code: EventAIErrorCode;
  constructor(code: EventAIErrorCode) { super(errors[code].message); this.name = "EventAIError"; this.code = code; this.status = errors[code].status; }
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) { return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }

/** Untrusted provider output must match every stage, with no partial or extra fields. */
export function validateEventAIDraft(value: unknown): EventAIDraft {
  if (!record(value) || !exactKeys(value, EVENT_AI_STAGES)) throw new EventAIError("provider");
  const result = {} as EventAIDraft;
  for (const stage of EVENT_AI_STAGES) {
    const copy = value[stage];
    if (!record(copy) || !exactKeys(copy, ["subject", "body"]) || typeof copy.subject !== "string" || typeof copy.body !== "string" || !copy.subject.trim() || !copy.body.trim() || copy.subject.length > 200 || copy.body.length > 3000 || /[\r\n\u0000\u2028\u2029]/.test(copy.subject) || /\u0000/.test(copy.body)) throw new EventAIError("provider");
    if ([copy.subject, copy.body].some(text => /\{\{|\}\}/.test(text.replaceAll("{{FIRST_NAME}}", "")))) throw new EventAIError("provider");
    result[stage] = { subject: copy.subject.trim(), body: copy.body.trim() };
  }
  return result;
}
