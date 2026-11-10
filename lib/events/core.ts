import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { EVENT_TEMPLATE_KEYS, normalizeEventTemplateKey, safeEventImageUrl, safeEventVenueUrl, normalizeEventEmailContent } from "./themes.ts";
export const STAGES = ["INITIAL", "FOLLOW_UP", "REMINDER"] as const;
export type Stage = typeof STAGES[number];
export function stageTargets(stage: string, response: string) {
  return stage === "INITIAL" || (stage === "FOLLOW_UP" && (response === "PENDING" || response === "MAYBE")) || (stage === "REMINDER" && response === "YES");
}
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newToken() { return randomBytes(32).toString("base64url"); }
export function validToken(token: unknown): token is string { return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token); }
function key(secret: string) { if (secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters for event invitations."); return createHash("sha256").update(`event-invitations:${secret}`).digest(); }
export function encrypt(value: string, secret: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  return Buffer.concat([iv, cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64url");
}
export function decrypt(value: string, secret: string) {
  const data = Buffer.from(value, "base64url"); const cipher = createDecipheriv("aes-256-gcm", key(secret), data.subarray(0,12)); cipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([cipher.update(data.subarray(12,-16)), cipher.final()]).toString("utf8");
}
export function defaultSchedule(initial: Date, startsAt: Date) {
  if (!Number.isFinite(+initial) || !Number.isFinite(+startsAt) || initial.getTime() < Date.now() + 60_000 || initial >= startsAt) throw new Error("Schedule the invitation at least one minute ahead and before the event.");
  const reminder = new Date(startsAt.getTime() - 86_400_000); const followUp = new Date(initial.getTime() + 14 * 86_400_000);
  return [{ stage: "INITIAL" as Stage, scheduledAt: initial }, ...(followUp < reminder ? [{stage: "FOLLOW_UP" as Stage, scheduledAt: followUp}] : []), ...(reminder > initial ? [{stage: "REMINDER" as Stage, scheduledAt: reminder}] : [])];
}
export function eventInput(input: Record<string, unknown>) {
  const text = (name: string, max: number) => typeof input[name] === "string" ? (input[name] as string).trim().slice(0,max) : "";
  const title = text("title",160), description = text("description",10000), location = text("location",500), timeZone = text("timeZone",100) || "America/Denver";
  const startsAt = input.startsAt instanceof Date ? new Date(input.startsAt) : new Date(text("startsAt",50));
  const endsAt = input.endsAt instanceof Date ? new Date(input.endsAt) : input.endsAt ? new Date(text("endsAt",50)) : null;
  if (!title || !description || !location || !Number.isFinite(+startsAt) || +startsAt <= Date.now()) throw new Error("Title, description, location and a future event date are required.");
  if (endsAt && (!Number.isFinite(+endsAt) || endsAt <= startsAt)) throw new Error("End time must be after the start.");
  new Intl.DateTimeFormat("en-US", {timeZone}).format(startsAt);
  const mode = text("mode",20); if (!["ALL","GROUPS","INDIVIDUALS"].includes(mode)) throw new Error("Choose an audience.");
  const ids = (name: string) => Array.isArray(input[name]) ? [...new Set((input[name] as unknown[]).filter((v): v is string => typeof v === "string" && v.length < 100))].slice(0,1000) : [];
  const clientIds = ids("clientIds"), groupIds = ids("groupIds");
  if ((mode === "INDIVIDUALS" && !clientIds.length) || (mode === "GROUPS" && !groupIds.length)) throw new Error("Select at least one client or group.");
  if (input.templateKey != null && !EVENT_TEMPLATE_KEYS.includes(input.templateKey as typeof EVENT_TEMPLATE_KEYS[number])) throw new Error("Choose an available invitation template.");
  const templateKey = normalizeEventTemplateKey(input.templateKey);
  const imageRequested = input.imageUrl != null && input.imageUrl !== "";
  const imageUrl = imageRequested ? safeEventImageUrl(input.imageUrl, [process.env.R2_PUBLIC_URL]) : null;
  if (imageRequested && !imageUrl) throw new Error("Choose a JPEG or PNG from the image library, or upload an image.");
  const imageAlt = imageUrl ? text("imageAlt",300) || title : null;
  const venueUrl = input.venueUrl ? safeEventVenueUrl(input.venueUrl) : null;
  if (input.venueUrl && !venueUrl) throw new Error("Enter a valid HTTPS venue website.");
  const emailContent = normalizeEventEmailContent(input.emailContent);
  return {title,description,location,timeZone,startsAt,endsAt,mode,clientIds,groupIds,templateKey,imageUrl,imageAlt,venueUrl,emailContent};
}

/** Partial draft changes preserve omitted stage and field overrides. Null resets all custom copy. */
export function eventDraftInput(existing: Record<string, unknown>, patch: Record<string, unknown>) {
  const input = {...existing, ...patch};
  if (patch.emailContent && typeof patch.emailContent === "object" && !Array.isArray(patch.emailContent)) {
    const previous = normalizeEventEmailContent(existing.emailContent);
    const changes = patch.emailContent as Record<string, unknown>;
    const merged: Record<string, unknown> = {...previous};
    for (const stage of ["INITIAL", "FOLLOW_UP", "REMINDER"] as const) {
      if (!(stage in changes)) continue;
      const change = changes[stage];
      merged[stage] = change && typeof change === "object" && !Array.isArray(change) ? {...previous[stage], ...change} : change;
    }
    input.emailContent = merged;
  }
  return eventInput(input);
}
