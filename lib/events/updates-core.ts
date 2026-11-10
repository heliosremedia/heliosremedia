export const EVENT_UPDATE_AUDIENCES = ["ALL_INVITED", "YES", "PENDING_OR_MAYBE"] as const;
export type EventUpdateAudience = typeof EVENT_UPDATE_AUDIENCES[number];
export type EventUpdateCopy = { subject: string; body: string; audience: EventUpdateAudience };
export type EventUpdateDelivery = { stage: string; updateSubject?: string | null; updateBody?: string | null; updateAudience?: string | null };
export const EVENT_UPDATE_MAX_BYTES = 64 * 1024;
export class EventUpdateConflict extends Error {}
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function eventUpdateStage(requestId: unknown): string {
  if (typeof requestId !== "string" || !requestIdPattern.test(requestId)) throw new Error("Create a new update request before scheduling.");
  return `UPDATE_${requestId.toLowerCase()}`;
}

export function isEventUpdateStage(stage: string): boolean {
  return stage.startsWith("UPDATE_") && requestIdPattern.test(stage.slice(7));
}

export function eventUpdateInput(value: unknown): EventUpdateCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter valid event update details.");
  const input = value as Record<string, unknown>;
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!subject || subject.length > 200 || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(subject)) throw new Error("Enter a single-line subject of 1 to 200 characters.");
  if (!body || body.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body)) throw new Error("Enter a message of 1 to 3,000 characters.");
  if (!EVENT_UPDATE_AUDIENCES.includes(input.audience as EventUpdateAudience)) throw new Error("Choose who should receive this event update.");
  return { subject, body, audience: input.audience as EventUpdateAudience };
}

export function eventUpdateCopy(delivery: EventUpdateDelivery): EventUpdateCopy {
  if (!isEventUpdateStage(delivery.stage)) throw new Error("Choose an event update.");
  return eventUpdateInput({subject:delivery.updateSubject,body:delivery.updateBody,audience:delivery.updateAudience});
}

export function eventUpdateTargets(audience: string | null | undefined, response: string): boolean {
  if (!["PENDING", "YES", "NO", "MAYBE"].includes(response)) return false;
  return audience === "ALL_INVITED" || (audience === "YES" && response === "YES") || (audience === "PENDING_OR_MAYBE" && (response === "PENDING" || response === "MAYBE"));
}

export function eventUpdateDate(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error("Choose a valid update delivery time.");
  const date = new Date(value);
  if (!Number.isFinite(+date) || date.toISOString() !== value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z")) throw new Error("Choose a valid update delivery time.");
  return date;
}

/** Bound the streamed body even if Content-Length is absent or inaccurate. */
export async function readEventUpdateBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > EVENT_UPDATE_MAX_BYTES) throw new Error("Event update request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Enter valid event update details.");
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > EVENT_UPDATE_MAX_BYTES) { await reader.cancel(); throw new Error("Event update request is too large."); }
      text += decoder.decode(value, {stream:true});
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("Enter valid event update details."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter valid event update details.");
  return parsed as Record<string, unknown>;
}
