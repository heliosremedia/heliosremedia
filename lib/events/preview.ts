import "server-only";
import { EVENT_TEMPLATE_KEYS, normalizeEventEmailContent, safeEventImageUrl, safeEventVenueUrl, type EventEmailStage } from "./themes";

export const EVENT_PREVIEW_MAX_BYTES = 128 * 1024;

/** Bound the bytes read, even when Content-Length is missing or inaccurate. */
export async function readEventPreviewBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > EVENT_PREVIEW_MAX_BYTES) throw new Error("Invitation preview is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Enter valid invitation preview details.");
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > EVENT_PREVIEW_MAX_BYTES) { await reader.cancel(); throw new Error("Invitation preview is too large."); }
      text += decoder.decode(value, {stream:true});
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { throw new Error("Enter valid invitation preview details."); }
}

/** Validate current form values without saving a draft or creating invitations. */
export function eventPreviewInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter valid invitation preview details.");
  const input = value as Record<string, unknown>;
  const text = (name: string, max: number) => {
    const value = input[name];
    if (value == null) return "";
    if (typeof value !== "string" || value.length > max) throw new Error(`Enter valid ${name} text (${max} characters or fewer).`);
    return value.trim();
  };
  const placeholders: string[] = [];
  const sample = (value: string, label: string, fallback: string) => {
    if (value) return value;
    placeholders.push(label);
    return fallback;
  };
  const title = sample(text("title",160), "Event title", "Your event title");
  const description = sample(text("description",10000), "Description", "Join us for a special gathering. Your event description will appear here.");
  const location = sample(text("location",500), "Location", "Your event location");
  const timeZone = text("timeZone",100) || "America/Denver";
  try { new Intl.DateTimeFormat("en-US", {timeZone}); } catch { throw new Error("Choose a valid time zone."); }
  const dateText = text("startsAt",50);
  // A visibly disclosed sample, never a scheduled event or inferred user date.
  const startsAt = new Date(sample(dateText,"Event date","2030-12-15T18:00:00.000Z"));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(dateText || startsAt.toISOString()) || !Number.isFinite(+startsAt) || (dateText && startsAt.toISOString() !== dateText.replace(/Z$/, dateText.includes(".") ? "Z" : ".000Z"))) throw new Error("Enter a valid event date.");
  const templateKey = input.templateKey ?? "CLASSIC";
  if (!EVENT_TEMPLATE_KEYS.includes(templateKey as typeof EVENT_TEMPLATE_KEYS[number])) throw new Error("Choose an available invitation template.");
  const stage = input.stage ?? "INITIAL";
  if (!["INITIAL","FOLLOW_UP","REMINDER"].includes(stage as string)) throw new Error("Choose a valid invitation stage.");
  const imageText = text("imageUrl",2000);
  const imageUrl = imageText ? safeEventImageUrl(imageText,[process.env.R2_PUBLIC_URL]) : null;
  if (imageText && !imageUrl) throw new Error("Choose a JPEG or PNG from the image library, or upload an image.");
  const imageAlt = text("imageAlt",300) || title;
  const venueText = text("venueUrl",2000);
  const venueUrl = venueText ? safeEventVenueUrl(venueText) : null;
  if (venueText && !venueUrl) throw new Error("Enter a valid HTTPS venue website.");
  // The shared normalizer permits missing fields; reject supplied non-text copy first.
  if (input.emailContent && typeof input.emailContent === "object" && !Array.isArray(input.emailContent)) {
    for (const entry of Object.values(input.emailContent)) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        for (const key of ["subject","body"]) {
          const field = (entry as Record<string, unknown>)[key];
          if (field != null && typeof field !== "string") throw new Error("Enter valid email subject and message text.");
        }
      }
    }
  }
  const emailContent = normalizeEventEmailContent(input.emailContent);
  return {event:{title,description,location,timeZone,startsAt,templateKey:templateKey as string,imageUrl,imageAlt,venueUrl,emailContent},stage:stage as EventEmailStage,placeholders};
}
