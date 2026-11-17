"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";

export type StudioAppearance = "day" | "night" | "system";
export const APPEARANCE_KEY = "helios-studio-appearance";
const CHANGE_EVENT = "helios-studio-appearance-change";
let memoryPreference: StudioAppearance | null = null;
export function normalizeAppearance(value: string | null): StudioAppearance {
  return value === "day" || value === "night" ? value : "system";
}
function snapshot(): StudioAppearance {
  if (memoryPreference) return memoryPreference;
  try { return normalizeAppearance(localStorage.getItem(APPEARANCE_KEY)); }
  catch { return "system"; }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === APPEARANCE_KEY || event.key === null) {
      memoryPreference = null;
      notify();
    }
  };
  window.addEventListener("storage", storage);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}
export function useStudioAppearance() {
  return useSyncExternalStore(subscribe, snapshot, () => "system" as const);
}
export const StudioAppearanceContext = createContext<StudioAppearance>("system");

// Runs before shell content is parsed. CSS handles system changes without JS.
export const appearanceBootstrap = `(function(s){try{var p=localStorage.getItem('${APPEARANCE_KEY}');s.parentElement.dataset.studioAppearance=(p==='day'||p==='night')?p:'system'}catch(e){}})(document.currentScript)`;

function setAppearance(value: StudioAppearance) {
  memoryPreference = value;
  try { localStorage.setItem(APPEARANCE_KEY, value); } catch { /* Keep this session usable. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const appearances = ["day", "night", "system"] as const;
const labels = { day: "Day", night: "Night", system: "System" };

function AppearanceIcon({ value }: { value: StudioAppearance }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {value === "night" ? <path d="M20.2 15.3A8.7 8.7 0 0 1 8.7 3.8 8.7 8.7 0 1 0 20.2 15.3Z" /> : value === "day" ? <>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </> : <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" /></>}
  </svg>;
}

export default function StudioAppearanceControl() {
  const appearance = useContext(StudioAppearanceContext);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    optionRefs.current[appearances.indexOf(appearance)]?.focus();
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open, appearance]);

  function closeAndFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  function choose(value: StudioAppearance) {
    setAppearance(value);
    closeAndFocus();
  }
  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocus();
      return;
    }
    const current = optionRefs.current.findIndex(option => option === document.activeElement);
    let next: number;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (current + 1) % appearances.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (current + appearances.length - 1) % appearances.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = appearances.length - 1;
    else return;
    event.preventDefault();
    optionRefs.current[next]?.focus();
  }
  return (
    <div ref={rootRef} className="studio-appearance-control" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={triggerRef} type="button" className="studio-appearance-trigger"
        aria-label={`Appearance: ${labels[appearance]}`} title={`Appearance: ${labels[appearance]}`}
        aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
        }}>
        <AppearanceIcon value={appearance} />
      </button>
      {open ? <div id={menuId} role="menu" aria-label="Appearance" className="studio-appearance-menu" onKeyDown={onMenuKeyDown}>
        <p className="studio-appearance-menu-label" aria-hidden="true">Appearance</p>
        {appearances.map((value, index) => <button key={value} ref={node => { optionRefs.current[index] = node; }}
          type="button" role="menuitemradio" aria-checked={appearance === value} tabIndex={-1}
          onClick={() => choose(value)}>
          <AppearanceIcon value={value} /><span>{labels[value]}</span>
          <span className="studio-appearance-check" aria-hidden="true">{appearance === value ? "✓" : ""}</span>
        </button>)}
      </div> : null}
    </div>
  );
}
