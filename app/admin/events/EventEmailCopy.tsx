"use client";

import { useLayoutEffect, useRef, useState } from "react";
import EventAIWriter from "./EventAIWriter";
import type { EventAIEditorSource } from "./ai-writing";
import { getEventEmailCopy, type EventEmailContent, type EventEmailStage } from "@/lib/events/themes";
import { resetEventEmailStage, setEventEmailField } from "./ui-helpers";
import { insertEventFirstName } from "./first-name-editor";

const stages = [
  { key: "INITIAL", label: "Initial invitation", detail: "Introduce the gathering and invite your guests to RSVP." },
  { key: "FOLLOW_UP", label: "14-day follow-up", detail: "A friendly nudge for guests who haven’t replied or chose maybe." },
  { key: "REMINDER", label: "Day-before reminder", detail: "Let confirmed guests know you’re looking forward to seeing them." },
] as const;
const input = "mt-2 w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)] disabled:opacity-50";

export default function EventEmailCopy({ title, description, value, disabled, onChange, aiSource }: { aiSource: EventAIEditorSource; title: string; description: string; value: EventEmailContent; disabled: boolean; onChange: (content: EventEmailContent) => void }) {
  const [stage, setStage] = useState<EventEmailStage>("INITIAL");
  const [insertionError, setInsertionError] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<{stage: EventEmailStage; field: "subject" | "body"; position: number} | null>(null);
  const suggested = getEventEmailCopy({ title: title || "Your event", description }, stage);
  const copy = value[stage] || { subject: "", body: "" };
  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    pendingCaret.current = null;
    if (!pending || pending.stage !== stage) return;
    const element = pending.field === "subject" ? subjectRef.current : bodyRef.current;
    element?.focus();
    element?.setSelectionRange(pending.position, pending.position);
  }, [stage, value]);
  function update(field: "subject" | "body", text: string) { setInsertionError(""); onChange(setEventEmailField(value, stage, field, text)); }
  function insertName(field: "subject" | "body") {
    if (disabled) return;
    const element = field === "subject" ? subjectRef.current : bodyRef.current;
    const result = insertEventFirstName({value:copy[field],suggested:suggested[field],field,selectionStart:element?.selectionStart,selectionEnd:element?.selectionEnd});
    if (result.error) { setInsertionError(result.error); return; }
    pendingCaret.current = {stage,field,position:result.caret};
    update(field,result.text);
  }
  return <fieldset disabled={disabled} className="border-t border-white/10 pt-6">
    <legend className="pr-3 text-xs uppercase tracking-widest text-[var(--helios-orange)]">03 / Make it personal</legend>
    <h3 className="mt-2 text-xl font-light text-white">The right words, at the right time.</h3>
    <p className="mt-2 text-sm leading-6 text-white/50">Customize the subject and message for each email. Event details, the venue link, RSVP choices, and the unsubscribe footer are included automatically.</p>
    <EventAIWriter source={aiSource} value={value} disabled={disabled} onChange={onChange} />
    <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Email message to edit">{stages.map(option => <button key={option.key} type="button" aria-pressed={stage === option.key} onClick={() => { pendingCaret.current = null; setInsertionError(""); setStage(option.key); }} className={`rounded-xl border px-3 py-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] ${stage === option.key ? "border-orange-300/50 bg-orange-300/5 text-orange-100" : "border-white/10 text-white/55 hover:border-white/35"}`}>{option.label}<span className="mt-1 block text-[10px] uppercase tracking-widest opacity-60">{value[option.key]?.subject || value[option.key]?.body ? "Customized" : "Suggested copy"}</span></button>)}</div>
    <div className="mt-4 space-y-4 rounded-xl border border-white/10 p-4 sm:p-5">
      <p className="text-xs leading-5 text-white/50">{stages.find(option => option.key === stage)?.detail} Suggested text is shown until you enter your own.</p>
      <div><label className="block text-sm text-white/70">Subject<input ref={subjectRef} className={input} maxLength={200} value={copy.subject} placeholder={suggested.subject} onChange={event => update("subject", event.target.value)} /></label><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => insertName("subject")} aria-label="Insert first name into subject" className="mt-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]">Insert first name</button></div>
      <div><label className="block text-sm text-white/70">Message<textarea ref={bodyRef} className={input} rows={7} maxLength={10000} value={copy.body} placeholder={suggested.body} onChange={event => update("body", event.target.value)} /><span className="mt-2 block text-xs leading-5 text-white/40">Plain text. Blank fields use the suggested copy. Changes stay in your draft until you save.</span></label><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => insertName("body")} aria-label="Insert first name into message" className="mt-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]">Insert first name</button></div>
      <p className="text-xs leading-5 text-white/50">{"Use {{FIRST_NAME}} for each guest’s first name. Previews and test emails use the sample name Alex. Missing names become “there,” as in “Hi there.” In a blank field, insertion keeps the suggested copy."}</p>
      {insertionError && <p role="alert" className="text-xs text-amber-100">{insertionError}</p>}
      <button type="button" disabled={!copy.subject && !copy.body} onClick={() => onChange(resetEventEmailStage(value, stage))} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:border-white/40 disabled:opacity-40">Use suggested copy for this email</button>
    </div>
  </fieldset>;
}
