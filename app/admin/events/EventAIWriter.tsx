"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_AI_STAGES, EVENT_AI_TONES, type EventAIDraft, type EventAITone } from "@/lib/events/ai-contract";
import type { EventEmailContent, EventEmailStage } from "@/lib/events/themes";
import { applyEventAIStages, createEventAIWriter, customizedEventAIStages, eventAIEditorSnapshot, validEventAIStage, type EventAIEditorSource } from "./ai-writing";

const labels: Record<EventEmailStage, string> = { INITIAL: "Initial invitation", FOLLOW_UP: "14-day follow-up", REMINDER: "Day-before reminder" };
const button = "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/40 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] disabled:cursor-not-allowed disabled:opacity-40";
const input = "mt-2 w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)] disabled:opacity-50";
type Review = { sourceKey: string; draft: EventAIDraft };

export default function EventAIWriter({ source, value, disabled, onChange }: {
  source: EventAIEditorSource; value: EventEmailContent; disabled: boolean; onChange: (value: EventEmailContent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tone, setTone] = useState<EventAITone>("Warm and welcoming");
  const [review, setReview] = useState<Review | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [writer] = useState(() => createEventAIWriter());
  const requestId = useRef(0);
  const activeRequest = useRef<number | null>(null);
  const sourceKey = eventAIEditorSnapshot(source, tone);
  const loading = pending === sourceKey;
  const stale = !!review && review.sourceKey !== sourceKey;
  const errorId = "event-ai-status";
  const panelId = "event-ai-writer-panel";
  const collapsedStatus = loading ? "Writing three emails…"
    : error ? "AI writing needs attention. Expand to review."
    : stale ? "Suggestions need refreshing. Expand to review."
    : review ? "Three email suggestions available."
    : message ? message : "";

  // No automatic provider request. Edits, unmount and event switches only invalidate work.
  useEffect(() => () => { requestId.current++; activeRequest.current = null; writer.cancel(); setPending(null); }, [sourceKey, writer]);

  function cancel() { requestId.current++; activeRequest.current = null; writer.cancel(); setPending(null); setMessage("Generation cancelled. Your email copy is unchanged."); }
  async function generate() {
    if (disabled || activeRequest.current !== null) return;
    if (review && !window.confirm("Replace the generated suggestions below? Your event’s current email copy will stay unchanged.")) return;
    const id = ++requestId.current;
    activeRequest.current = id;
    setPending(sourceKey); setError(""); setMessage("");
    try {
      const draft = await writer.generate(source, tone);
      if (id !== requestId.current || !draft) return;
      setReview({ sourceKey, draft });
      setMessage("Three suggestions are ready to review. Nothing has been applied or saved.");
    } catch (error) {
      if (id === requestId.current) setError(error instanceof Error ? error.message : "AI writing is unavailable. Your email copy is unchanged.");
    } finally { if (id === requestId.current) { activeRequest.current = null; setPending(null); } }
  }
  function edit(stage: EventEmailStage, field: "subject" | "body", text: string) {
    setReview(previous => previous ? { ...previous, draft: { ...previous.draft, [stage]: { ...previous.draft[stage], [field]: text } } } : null);
    setMessage("");
  }
  function apply(stages: readonly EventEmailStage[]) {
    if (!review || stale || loading || disabled || stages.some(stage => !validEventAIStage(review.draft, stage))) return;
    const replacing = customizedEventAIStages(value, review.draft, stages);
    if (replacing.length && !window.confirm(`Replace your customized copy for ${replacing.map(stage => labels[stage]).join(", ")}? These changes remain unsaved until you choose Save draft.`)) return;
    onChange(applyEventAIStages(value, review.draft, stages));
    setMessage(`${stages.length === 3 ? "All three emails" : labels[stages[0]]} applied to your editor. Choose Save draft to keep the changes. Nothing has been sent or scheduled.`);
  }
  return <section className="mt-5 rounded-xl border border-orange-300/20 bg-orange-300/[0.03] p-4 sm:p-5" aria-label="AI email writer">
    <h4><button type="button" aria-expanded={expanded} aria-controls={panelId} disabled={disabled} onClick={() => setExpanded(previous => !previous)} className="flex w-full items-center justify-between gap-3 rounded-lg text-left text-base text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)] disabled:opacity-50">
      <span>AI email writer<span className="mt-1 block text-xs font-normal text-white/50">A little help finding the words</span></span>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-orange-200 ${expanded ? "rotate-180" : ""}`}><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button></h4>
    <p role="status" aria-live="polite" hidden={expanded || !collapsedStatus} className="mt-3 text-xs leading-5 text-white/60">{collapsedStatus}</p>
    <div id={panelId} hidden={!expanded}>
    <p className="mt-2 text-sm leading-6 text-white/60">Draft the invitation, follow-up, and day-before reminder together, then review and edit each one.</p>
    <p className="mt-2 text-xs leading-5 text-white/45">Generate sends only the event title, description, dates, time zone, location, venue website, and tone to OpenAI. Guest lists and existing email copy are not included. Keep private guest details out of the event description.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm text-white/70">Writing tone<select className={input} disabled={disabled} value={tone} onChange={event => { setTone(event.target.value as EventAITone); setError(""); setMessage(""); }}>{EVENT_AI_TONES.map(option => <option key={option}>{option}</option>)}</select></label>
      <button className={`${button} border-orange-300/40 text-orange-100`} type="button" disabled={disabled || loading || !source.title.trim() || !source.description.trim()} onClick={() => void generate()} aria-describedby={errorId}>{loading ? "Writing three emails…" : review ? "Generate again" : "Generate all three emails"}</button>
      {loading && <button className={button} type="button" onClick={cancel}>Cancel generation</button>}
    </div>
    {(!source.title.trim() || !source.description.trim()) && <p className="mt-3 text-xs text-white/50">Add an event title and description to get started.</p>}
    <div id={errorId} aria-live="polite">{error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}{message && <p role="status" className="mt-3 text-sm leading-6 text-emerald-200">{message}</p>}</div>
    {review && <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
      <div><h5 className="text-sm text-white">Review AI suggestions</h5><p className="mt-2 text-xs leading-5 text-white/50">Check every detail. Editing suggestions below does not change your email copy until you apply them. Event details and links are added automatically.</p></div>
      {stale && <p role="status" className="rounded-lg border border-amber-200/20 p-3 text-sm text-amber-100">Event details or tone changed. Generate again before applying these suggestions.</p>}
      {EVENT_AI_STAGES.map(stage => <fieldset key={stage} disabled={disabled || loading || stale} className="rounded-xl border border-white/10 p-4"><legend className="px-2 text-sm text-white/80">{labels[stage]}</legend>
        <label className="block text-sm text-white/65">Suggested subject<input className={input} aria-label={`${labels[stage]} suggested subject`} maxLength={200} value={review.draft[stage].subject} onChange={event => edit(stage, "subject", event.target.value)} /></label>
        <label className="mt-3 block text-sm text-white/65">Suggested message<textarea className={input} aria-label={`${labels[stage]} suggested message`} rows={5} maxLength={3000} value={review.draft[stage].body} onChange={event => edit(stage, "body", event.target.value)} /></label>
        {!validEventAIStage(review.draft, stage) && <p className="mt-2 text-xs text-amber-100">Add a nonempty single-line subject and message before applying.</p>}
        <button className={`${button} mt-3`} type="button" disabled={disabled || loading || stale || !validEventAIStage(review.draft, stage)} onClick={() => apply([stage])}>Apply {labels[stage].toLowerCase()}</button>
      </fieldset>)}
      <div className="flex flex-wrap gap-3"><button className={`${button} border-orange-300/40 text-orange-100`} type="button" disabled={disabled || loading || stale || EVENT_AI_STAGES.some(stage => !validEventAIStage(review.draft, stage))} onClick={() => apply(EVENT_AI_STAGES)}>Apply all three emails</button><button className={button} type="button" disabled={disabled || loading} onClick={() => { setReview(null); setMessage("Suggestions discarded. Your email copy is unchanged."); }}>Discard suggestions</button></div>
    </div>}
    </div>
  </section>;
}
