"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

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

export default function StudioAppearanceControl() {
  const appearance = useContext(StudioAppearanceContext);
  return (
    <fieldset className="studio-appearance-control">
      <legend>Appearance</legend>
      <div className="studio-appearance-options">
        {(["day", "night", "system"] as const).map((value) => (
          <label key={value}>
            <input type="radio" name="studio-appearance" value={value} checked={appearance === value}
              onChange={() => {
                memoryPreference = value;
                try { localStorage.setItem(APPEARANCE_KEY, value); } catch { /* Keep this session usable. */ }
                window.dispatchEvent(new Event(CHANGE_EVENT));
              }} />
            <span>{value.charAt(0).toUpperCase() + value.slice(1)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
