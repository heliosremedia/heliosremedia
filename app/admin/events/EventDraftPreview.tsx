"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_THEMES, type EventEmailStage, type EventTemplateKey } from "@/lib/events/themes";
import type { EventEditorForm } from "./ui-helpers";
import { createDraftPreviewLoader, draftPreviewDocument, type DraftPreview } from "./draft-preview";

const stages: Record<EventEmailStage, string> = { INITIAL: "Initial invitation", FOLLOW_UP: "14-day follow-up", REMINDER: "Day-before reminder" };
const button = "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/40 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] disabled:opacity-40";
const input = "mt-2 w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]";

export default function EventDraftPreview({ form, onClose, onApplyStyle }: {
  form: EventEditorForm;
  onClose: () => void;
  onApplyStyle: (templateKey: EventTemplateKey) => void;
}) {
  const [templateKey, setTemplateKey] = useState(form.templateKey);
  const [stage, setStage] = useState<EventEmailStage>("INITIAL");
  const [width, setWidth] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [result, setResult] = useState<DraftPreview | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loader] = useState(() => createDraftPreviewLoader());
  const styleInput = useRef<HTMLSelectElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameKeyboardCleanup = useRef<(() => void) | null>(null);
  const latestOnClose = useRef(onClose);

  useEffect(() => { latestOnClose.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Use the browser modal for inert background content and standard dismissal.
    dialog?.showModal();
    styleInput.current?.focus();
    return () => {
      frameKeyboardCleanup.current?.();
      frameKeyboardCleanup.current = null;
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void loader.load(form, templateKey, stage).then(preview => {
      if (active && preview) { setResult(preview); setLoading(false); }
    }).catch(cause => {
      if (active) { setError(cause instanceof Error ? cause.message : "The invitation preview could not be loaded."); setLoading(false); }
    });
    return () => { active = false; loader.cancel(); };
  }, [form, loader, retry, stage, templateKey]);

  function detachFrameKeyboard() {
    frameKeyboardCleanup.current?.();
    frameKeyboardCleanup.current = null;
  }

  function invalidate() {
    detachFrameKeyboard(); loader.cancel(); setResult(null); setError(""); setLoading(true);
  }
  function close() { detachFrameKeyboard(); loader.cancel(); latestOnClose.current(); }
  function attachFrameKeyboard(frame: HTMLIFrameElement) {
    detachFrameKeyboard();
    const previewDocument = frame.contentDocument;
    if (!previewDocument) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    // Same-origin access lets the parent handle Escape inside the preview document.
    // Scripts remain disabled: never add allow-scripts to this iframe's sandbox.
    previewDocument.addEventListener("keydown", onKeyDown, true);
    frameKeyboardCleanup.current = () => previewDocument.removeEventListener("keydown", onKeyDown, true);
  }

  return <dialog ref={dialogRef} aria-labelledby="event-draft-preview-title" aria-modal="true" onCancel={event => { event.preventDefault(); close(); }} onClose={event => { if (!event.currentTarget.open) close(); }}
    onMouseDown={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}
    className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-0 text-white shadow-2xl backdrop:bg-black/85 backdrop:backdrop-blur-md">
    <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
      <div><p className="text-xs uppercase tracking-widest text-[var(--helios-orange)]">Preview · Unsaved draft</p><h2 id="event-draft-preview-title" className="mt-2 text-2xl font-light text-white">Your invitation, dressed for the occasion.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Try a different look with your current event details and email wording. Nothing is saved, sent, or scheduled here.</p></div>
      <button type="button" onClick={close} className={button}>Close</button>
    </header>
    <div className="p-4 sm:p-6">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs text-white/65">Seasonal style<select ref={styleInput} className={input} value={templateKey} onChange={event => { invalidate(); setTemplateKey(event.target.value as EventTemplateKey); }}>{EVENT_THEMES.map(theme => <option key={theme.key} value={theme.key}>{theme.label}</option>)}</select></label>
        <label className="text-xs text-white/65">Email to preview<select className={input} value={stage} onChange={event => { invalidate(); setStage(event.target.value as EventEmailStage); }}>{Object.entries(stages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div className="flex gap-2" role="group" aria-label="Invitation preview width">{(["DESKTOP", "MOBILE"] as const).map(option => <button key={option} type="button" aria-pressed={width === option} className={`${button} ${width === option ? "border-orange-300/50 bg-orange-300/5 text-orange-100" : ""}`} onClick={() => setWidth(option)}>{option === "DESKTOP" ? "Desktop" : "Mobile"}</button>)}</div>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-white/15" aria-busy={loading}>
        {loading && <p role="status" className="flex min-h-80 items-center justify-center p-8 text-sm text-white/60">Preparing your invitation…</p>}
        {error && <div role="alert" className="p-6 text-sm text-red-100"><p>{error}</p><p className="mt-2 text-white/50">Close the preview to edit your draft, or try again.</p><button type="button" className={`${button} mt-4`} onClick={() => { invalidate(); setRetry(value => value + 1); }}>Try again</button></div>}
        {result && <>
          <div className="bg-white/5 p-4"><p className="break-words text-sm text-white/85"><span className="text-white/45">Subject: </span>{result.subject}</p>{result.placeholders.length > 0 && <p role="status" className="mt-3 text-xs leading-5 text-amber-100">Sample content is shown for: {result.placeholders.join(", ")}. These placeholders are only for this preview and won’t be added to your draft.</p>}</div>
          <div className="bg-black/30 p-2 sm:p-4"><iframe title={`${stages[stage]} invitation preview`} sandbox="allow-same-origin" referrerPolicy="no-referrer" tabIndex={0} onLoad={event => attachFrameKeyboard(event.currentTarget)} srcDoc={draftPreviewDocument(result.html)} className="mx-auto h-[60vh] min-h-80 w-full bg-white transition-[max-width]" style={{ maxWidth: width === "MOBILE" ? 375 : 760 }} /></div>
        </>}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/45">First-name fields show Alex, a sample name. Each guest’s name is added only at delivery; missing names use “there.” RSVP choices are disabled in previews. Email apps may display spacing and fonts slightly differently.</p>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5 sm:p-6"><p className="text-xs leading-5 text-white/45">Browsing styles doesn’t change your draft.</p><div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={close}>Back to editing</button><button type="button" className={`${button} border-orange-400/40 bg-[var(--helios-orange)] text-black hover:brightness-110`} onClick={() => { loader.cancel(); onApplyStyle(templateKey); }}>Use this style in draft</button></div></footer>
  </dialog>;
}
