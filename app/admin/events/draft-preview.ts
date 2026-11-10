import { zonedLocalToUtc } from "../../../lib/client-communications/scheduling.ts";
import type { EventEmailStage, EventTemplateKey } from "../../../lib/events/themes.ts";
import type { EventEditorForm } from "./ui-helpers.ts";

export type DraftPreview = { html: string; subject: string; placeholders: string[] };

/** Preserve the real email design, but make venue/unsubscribe links inert in the preview. */
export function draftPreviewDocument(html: string) {
  return html.replace(/<a\b([^>]*)>/gi, (_tag, attributes: string) =>
    `<a${attributes.replace(/\s+href="[^"]*"/gi, "")} aria-disabled="true">`);
}

/** Only presentation fields leave the editor. Preview cannot supply a recipient or an action. */
export function draftPreviewPayload(form: EventEditorForm, templateKey: EventTemplateKey, stage: EventEmailStage) {
  return {
    title: form.title, description: form.description, location: form.location,
    venueUrl: form.venueUrl, emailContent: form.emailContent,
    startsAt: form.startsAt ? zonedLocalToUtc(form.startsAt, form.timeZone).toISOString() : null,
    timeZone: form.timeZone, templateKey, imageUrl: form.imageUrl, imageAlt: form.imageAlt, stage,
  };
}

/** Each new preview invalidates the previous result, even if fetch ignores cancellation. */
export function createDraftPreviewLoader(request: typeof fetch = fetch) {
  let controller: AbortController | null = null;
  let generation = 0;
  function cancel() {
    generation += 1;
    controller?.abort();
    controller = null;
  }
  async function load(form: EventEditorForm, templateKey: EventTemplateKey, stage: EventEmailStage): Promise<DraftPreview | null> {
    cancel();
    const current = generation;
    const pending = new AbortController();
    controller = pending;
    const isCurrent = () => current === generation && !pending.signal.aborted;
    try {
      // Serialize immediately so edits after this call cannot mutate the in-flight snapshot.
      const body = JSON.stringify(draftPreviewPayload(form, templateKey, stage));
      const response = await request("/api/admin/events/preview", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body, signal: pending.signal,
      });
      if (!isCurrent()) return null;
      const data = await response.json();
      if (!isCurrent()) return null;
      if (!response.ok || data.success !== true) throw new Error(data.error || "The invitation preview could not be loaded. Please try again.");
      if (typeof data.html !== "string" || typeof data.subject !== "string" || !Array.isArray(data.placeholders) || !data.placeholders.every((label: unknown) => typeof label === "string")) throw new Error("The invitation preview could not be loaded. Please try again.");
      return { html: data.html, subject: data.subject, placeholders: data.placeholders };
    } catch (cause) {
      if (!isCurrent()) return null;
      throw cause;
    } finally {
      if (isCurrent()) controller = null;
    }
  }
  return { load, cancel };
}
