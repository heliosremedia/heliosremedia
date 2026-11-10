import { zonedLocalToUtc } from "../../../lib/client-communications/scheduling.ts";
import { EVENT_AI_STAGES, EventAIError, validateEventAIDraft, type EventAIDraft, type EventAISource, type EventAITone } from "../../../lib/events/ai-contract.ts";
import type { EventEmailContent, EventEmailStage } from "../../../lib/events/themes.ts";
import type { EventEditorForm } from "./ui-helpers.ts";

export type EventAIEditorSource = Pick<EventEditorForm, "title" | "description" | "startsAt" | "endsAt" | "timeZone" | "location" | "venueUrl">;

/** Deliberately do not spread the editor: it also contains private guest selection. */
export function eventAIEditorSnapshot(source: EventAIEditorSource, tone: EventAITone) {
  return JSON.stringify({ title: source.title, description: source.description, startsAt: source.startsAt, endsAt: source.endsAt, timeZone: source.timeZone, location: source.location, venueUrl: source.venueUrl, tone });
}
export function eventAIEditorPayload(source: EventAIEditorSource, tone: EventAITone): EventAISource {
  return {
    title: source.title, description: source.description,
    startsAt: source.startsAt ? zonedLocalToUtc(source.startsAt, source.timeZone).toISOString() : null,
    endsAt: source.endsAt ? zonedLocalToUtc(source.endsAt, source.timeZone).toISOString() : null,
    timeZone: source.timeZone, location: source.location, venueUrl: source.venueUrl, tone,
  };
}
export function validEventAIStage(draft: EventAIDraft, stage: EventEmailStage) {
  try { validateEventAIDraft({ INITIAL: draft[stage], FOLLOW_UP: draft[stage], REMINDER: draft[stage] }); return true; } catch { return false; }
}
export function customizedEventAIStages(current: EventEmailContent, draft: EventAIDraft, stages: readonly EventEmailStage[]) {
  return stages.filter(stage => {
    const copy = current[stage];
    return !!(copy?.subject?.trim() || copy?.body?.trim()) && (copy?.subject !== draft[stage].subject || copy?.body !== draft[stage].body);
  });
}
/** Apply only the explicitly selected stages; persistence and sending are separate. */
export function applyEventAIStages(current: EventEmailContent, draft: EventAIDraft, stages: readonly EventEmailStage[]): EventEmailContent {
  const result = { ...current };
  for (const stage of stages) {
    if (!EVENT_AI_STAGES.includes(stage) || !validEventAIStage(draft, stage)) throw new EventAIError("provider");
    result[stage] = { subject: draft[stage].subject.trim(), body: draft[stage].body.trim() };
  }
  return result;
}

export function createEventAIWriter(request: typeof fetch = fetch) {
  let generation = 0, controller: AbortController | null = null;
  function cancel() { generation++; controller?.abort(); controller = null; }
  async function generate(source: EventAIEditorSource, tone: EventAITone): Promise<EventAIDraft | null> {
    cancel();
    const current = generation, pending = new AbortController();
    controller = pending;
    const isCurrent = () => generation === current && !pending.signal.aborted;
    try {
      const response = await request("/api/admin/events/ai", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventAIEditorPayload(source, tone)), signal: pending.signal,
      });
      if (!isCurrent()) return null;
      const data = await response.json();
      if (!isCurrent()) return null;
      if (!response.ok || data.success !== true) {
        // Use controlled local messages, never display arbitrary server/provider output.
        throw new EventAIError(response.status === 400 ? "input" : response.status === 429 ? "rate" : response.status === 504 ? "timeout" : response.status === 503 ? "unavailable" : "provider");
      }
      return validateEventAIDraft(data.draft);
    } catch (error) { if (!isCurrent()) return null; throw error instanceof EventAIError ? error : new EventAIError("provider"); }
    finally { if (isCurrent()) controller = null; }
  }
  return { generate, cancel };
}
