"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type WorkspaceTab = { id: string; label: string; content: ReactNode; hashAliases?: string[] };

/** Persistent panels preserve drafts and selections. Switching tabs never performs a write. */
export default function AdminWorkspaceTabs({ id, label, tabs }: { id: string; label: string; tabs: WorkspaceTab[] }) {
  const [selected, setSelected] = useState(tabs[0]?.id ?? "");
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const hashTargets = JSON.stringify(tabs.map(tab => ({ id: tab.id, aliases: tab.hashAliases ?? [] })));
  const active = tabs.some(tab => tab.id === selected) ? selected : tabs[0]?.id;
  useEffect(() => {
    const available = JSON.parse(hashTargets) as { id: string; aliases: string[] }[];
    function followHash() {
      const target = window.location.hash.slice(1);
      const match = available.find(tab => target === `${id}-${tab.id}` || tab.aliases.includes(target));
      if (match) {
        setSelected(match.id);
        requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
      }
    }
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [id, hashTargets]);
  return <div className="min-w-0 space-y-6">
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.08] bg-[#111] p-2">
      {tabs.map((tab, index) => <button key={tab.id} ref={node => { buttons.current[tab.id] = node; }} type="button" role="tab" id={`${id}-tab-${tab.id}`} aria-controls={`${id}-${tab.id}`} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1}
        onClick={() => setSelected(tab.id)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault();
          setSelected(tabs[next].id);
          buttons.current[tabs[next].id]?.focus();
        }} className={`rounded-xl border px-4 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)] ${active === tab.id ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/10 text-white" : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"}`}>{tab.label}</button>)}
    </div>
    {tabs.map(tab => <section key={tab.id} role="tabpanel" id={`${id}-${tab.id}`} aria-labelledby={`${id}-tab-${tab.id}`} hidden={active !== tab.id} tabIndex={0} className="min-w-0 space-y-7">{tab.content}</section>)}
  </div>;
}
