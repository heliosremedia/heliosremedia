import { normalizeEventTemplateKey, normalizeEventEmailContent, type EventEmailContent, type EventEmailStage, type EventTemplateKey } from "../../../lib/events/themes.ts";

export type EventAppearanceFields = { templateKey: EventTemplateKey; imageUrl: string; imageAlt: string };
export type EventEditorData = { title: string; description: string; location: string; venueUrl?: string | null; emailContent?: unknown; startsAt: string | null; endsAt: string | null; timeZone: string; mode: string; clientIds?: string[]; groupIds?: string[]; selection?: { clientIds?: string[]; groupIds?: string[] }; templateKey?: unknown; imageUrl?: string | null; imageAlt?: string | null };
export type EventEditorForm = EventAppearanceFields & { title: string; description: string; location: string; venueUrl: string; emailContent: EventEmailContent; startsAt: string; endsAt: string; timeZone: string; mode: string; clientIds: string[]; groupIds: string[] };

export function setEventEmailField(content: EventEmailContent, stage: EventEmailStage, field: "subject" | "body", text: string): EventEmailContent {
  return { ...content, [stage]: { subject: content[stage]?.subject || "", body: content[stage]?.body || "", [field]: text } };
}

export function resetEventEmailStage(content: EventEmailContent, stage: EventEmailStage): EventEmailContent {
  // Explicit empty overrides reset persisted custom copy; omission means preserve on PATCH.
  return { ...content, [stage]: { subject: "", body: "" } };
}

export function createEventForm(event?: EventEditorData | null): EventEditorForm {
  return event ? {
    title: event.title, description: event.description, location: event.location, venueUrl: event.venueUrl || "", emailContent: normalizeEventEmailContent(event.emailContent),
    startsAt: localDateTime(event.startsAt, event.timeZone), endsAt: localDateTime(event.endsAt, event.timeZone),
    timeZone: event.timeZone, mode: event.mode,
    clientIds: [...(event.clientIds || event.selection?.clientIds || [])], groupIds: [...(event.groupIds || event.selection?.groupIds || [])],
    ...eventAppearance(event),
  } : { title: "", description: "", location: "", venueUrl: "", emailContent: {}, startsAt: "", endsAt: "", timeZone: "America/Denver", mode: "ALL", clientIds: [], groupIds: [], ...eventAppearance() };
}

export function eventAppearance(event?: { templateKey?: unknown; imageUrl?: string | null; imageAlt?: string | null } | null): EventAppearanceFields {
  return {
    templateKey: normalizeEventTemplateKey(event?.templateKey),
    imageUrl: event?.imageUrl || "",
    imageAlt: event?.imageUrl ? event.imageAlt || "" : "",
  };
}

export function selectEventImage<T extends EventAppearanceFields>(form: T, image: { url: string; altText?: string | null } | null): T {
  return { ...form, imageUrl: image?.url || "", imageAlt: image?.url ? (image.altText || "").slice(0, 300) : "" };
}

export function eventImageUploadError(file: { type: string; size: number }): string | null {
  if (!["image/jpeg", "image/png"].includes(file.type)) return "Choose a JPG or PNG image so it displays reliably in email.";
  if (!Number.isFinite(file.size) || file.size <= 0) return "That image is empty. Choose another file.";
  if (file.size > 10 * 1024 * 1024) return "Choose an image no larger than 10 MB.";
  return null;
}

export function localDateTime(value: string | null, timeZone: string): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

export function displayDate(value: string | null, timeZone: string): string {
  return value ? new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date not set";
}

export function responseCounts(invitations: { response: string }[] = []) {
  return { total: invitations.length, yes: invitations.filter(i => i.response === "YES").length, no: invitations.filter(i => i.response === "NO").length, maybe: invitations.filter(i => i.response === "MAYBE").length, pending: invitations.filter(i => i.response === "PENDING").length };
}
