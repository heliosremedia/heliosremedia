import { zonedLocalToUtc } from "../../../lib/client-communications/scheduling.ts";
import { EVENT_FIRST_NAME_TOKEN } from "../../../lib/events/personalization.ts";

export const EVENT_UPDATE_AUDIENCES = [
  { value: "ALL_INVITED", label: "All invited guests", detail: "Includes guests who declined." },
  { value: "YES", label: "Confirmed guests only", detail: "Guests who answered yes." },
  { value: "PENDING_OR_MAYBE", label: "Awaiting reply or maybe", detail: "Guests who have not replied or answered maybe." },
] as const;
export type EventUpdateAudience = typeof EVENT_UPDATE_AUDIENCES[number]["value"];
export type EventUpdateDraft = { subject: string; body: string; audience: EventUpdateAudience | "" };
export type EventUpdateDelivery = { id: string; stage: string; status: string; scheduledAt: string; updateSubject?: string | null; updateBody?: string | null; updateAudience?: string | null };
export type EventUpdateEvent = { id: string; title: string; status: string; startsAt: string | null; timeZone: string; deliveries?: EventUpdateDelivery[] };

export function eventUpdateCopyError(draft: EventUpdateDraft) {
  if (!draft.subject.trim() || draft.subject.length > 200 || /[\r\n\u2028\u2029]/u.test(draft.subject)) return "Enter a single-line subject of up to 200 characters.";
  if (!draft.body.trim() || draft.body.length > 3000) return "Enter a message of up to 3,000 characters.";
  if (!EVENT_UPDATE_AUDIENCES.some(option => option.value === draft.audience)) return "Choose who should receive this update.";
  return "";
}

export function eventUpdateSendTime(local: string, event: Pick<EventUpdateEvent, "timeZone" | "startsAt">, now = Date.now()) {
  const time = zonedLocalToUtc(local, event.timeZone);
  if (time.getTime() < now + 60_000) throw new Error("Choose a delivery time at least one minute ahead.");
  if (!event.startsAt || time.getTime() >= new Date(event.startsAt).getTime()) throw new Error("Schedule this update before the event starts.");
  return time.toISOString();
}

/** One logical schedule keeps its key after a lost response. Editing any scheduling field rotates it. */
export function createEventUpdateRequestKey(makeId: () => string) {
  let fingerprint = "", requestId = "";
  return {
    forPayload(payload: { eventId: string; subject: string; body: string; audience: EventUpdateAudience | ""; scheduledAt: string }) {
      const next = JSON.stringify([payload.eventId, payload.subject, payload.body, payload.audience, payload.scheduledAt]);
      if (next !== fingerprint) { fingerprint = next; requestId = makeId(); }
      return requestId;
    },
  };
}

export function insertUpdateFirstName(value: string, field: "subject" | "body", start = value.length, end = start) {
  const from = Math.max(0, Math.min(value.length, start)), to = Math.max(from, Math.min(value.length, end));
  const text = value.slice(0, from) + EVENT_FIRST_NAME_TOKEN + value.slice(to);
  const limit = field === "subject" ? 200 : 3000;
  if (text.length > limit) return { error: `Make room for the first-name field. ${field === "subject" ? "Subjects allow 200" : "Messages allow 3,000"} characters.` } as const;
  return { text, caret: from + EVENT_FIRST_NAME_TOKEN.length } as const;
}

/** Generated previews are sandboxed; also remove navigation and constrain resource loading. */
export function eventUpdatePreviewDocument(html: string) {
  const inert = html.replace(/<a\b([^>]*)>/gi, (_tag, attributes: string) => `<a${attributes.replace(/\s+href\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")} aria-disabled="true">`);
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">${inert}`;
}

export function eventUpdateHistory(deliveries: EventUpdateDelivery[] = []) {
  return deliveries.filter(delivery => delivery.stage.startsWith("UPDATE_")).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

export function eventUpdateStatus(status: string) {
  return ({ SCHEDULED: "Scheduled", PROCESSING: "Sending", SENT: "Sent", COMPLETED: "Completed", COMPLETE: "Completed", CANCELLED: "Cancelled", FAILED: "Failed" } as Record<string, string>)[status] || status;
}
