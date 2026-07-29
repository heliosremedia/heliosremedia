"use client";

import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  normalizeDashboardPreferences,
  type DashboardCardId,
  type DashboardPreferences,
} from "@/lib/dashboard-layout";

type Card = { id: DashboardCardId; title: string; content: ReactNode };

export default function DashboardOrganizer({ initialPreferences, cards }: {
  initialPreferences: DashboardPreferences;
  cards: Card[];
}) {
  const [preferences, setPreferences] = useState(() => normalizeDashboardPreferences(initialPreferences));
  const [organizing, setOrganizing] = useState(false);
  const [dragged, setDragged] = useState<DashboardCardId | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const refs = useRef<Partial<Record<DashboardCardId, HTMLButtonElement | null>>>({});
  const byId = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards]);

  async function persist(next: DashboardPreferences, success: string) {
    const previous = preferences;
    setPreferences(next); setSaving(true); setMessage("Saving dashboard layout…");
    try {
      const response = await fetch("/api/admin/dashboard-layout", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Dashboard layout could not be saved.");
      setPreferences(normalizeDashboardPreferences(result.preferences)); setMessage(success);
    } catch (error) {
      setPreferences(previous); setMessage(error instanceof Error ? error.message : "Dashboard layout could not be saved.");
    } finally { setSaving(false); }
  }

  function move(id: DashboardCardId, target: number) {
    const order = preferences.order.filter(item => item !== id);
    order.splice(Math.max(0, Math.min(target, order.length)), 0, id);
    void persist({ ...preferences, order }, `${byId.get(id)?.title} moved to position ${order.indexOf(id) + 1}.`);
    refs.current[id]?.focus();
  }

  function toggle(id: DashboardCardId) {
    const collapsed = preferences.collapsed.includes(id)
      ? preferences.collapsed.filter(item => item !== id)
      : [...preferences.collapsed, id];
    void persist({ ...preferences, collapsed }, `${byId.get(id)?.title} ${collapsed.includes(id) ? "collapsed" : "expanded"}.`);
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.08] bg-white/[.02] p-3">
      <p role="status" aria-live="polite" className="px-2 text-xs text-white/40">{message || (organizing ? "Drag by a handle or use Move Up and Move Down." : "Dashboard layout saved per account.")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOrganizing(value => !value)} className={organizing ? "admin-btn-primary" : "admin-btn-secondary"}>{organizing ? "Done Organizing" : "Organize Dashboard"}</button>
        <button type="button" disabled={saving} onClick={() => void persist({ ...preferences, collapsed: [] }, "All dashboard cards expanded.")} className="admin-btn-secondary">Expand All</button>
        <button type="button" disabled={saving} onClick={() => void persist({ ...preferences, collapsed: [...preferences.order] }, "All dashboard cards collapsed.")} className="admin-btn-secondary">Collapse All</button>
        <button type="button" disabled={saving} onClick={() => confirm("Reset dashboard order and collapsed cards?") && void persist(DEFAULT_DASHBOARD_PREFERENCES, "Default dashboard layout restored.")} className="admin-btn-secondary">Reset Layout</button>
      </div>
    </div>
    <div className="space-y-4">
      {preferences.order.map((id, index) => {
        const card = byId.get(id); if (!card) return null;
        const collapsed = preferences.collapsed.includes(id);
        return <div key={id}>
          {organizing && dropIndex === index ? <div className="h-1 rounded-full bg-[var(--helios-orange)] shadow-[0_0_16px_rgba(217,107,43,.8)]" aria-hidden="true" /> : null}
          <section
            onDragOver={event => { if (organizing) { event.preventDefault(); setDropIndex(index); } }}
            onDrop={event => { event.preventDefault(); if (dragged) move(dragged, index); setDragged(null); setDropIndex(null); }}
            className={`overflow-hidden rounded-2xl border bg-[#111] transition ${dragged === id ? "scale-[.99] border-[var(--helios-orange)]/50 opacity-60" : "border-white/[.08]"}`}
          >
            <header className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <button ref={node => { refs.current[id] = node; }} type="button" onClick={() => toggle(id)} aria-expanded={!collapsed} className="text-left text-xl font-light text-white focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]">{card.title}</button>
              <div className="flex flex-wrap gap-2">
                {organizing ? <>
                  <span draggable onDragStart={(event: DragEvent<HTMLSpanElement>) => { setDragged(id); event.dataTransfer.setData("text/plain", id); }} onDragEnd={() => { setDragged(null); setDropIndex(null); }} className="cursor-grab rounded-xl border border-white/10 px-4 py-2 text-white/40" aria-label={`Drag ${card.title}`}>⠿</span>
                  <button type="button" disabled={index === 0 || saving} onClick={() => move(id, index - 1)} className="admin-btn-secondary">Move Up</button>
                  <button type="button" disabled={index === preferences.order.length - 1 || saving} onClick={() => move(id, index + 1)} className="admin-btn-secondary">Move Down</button>
                </> : null}
                <button type="button" onClick={() => toggle(id)} className="admin-btn-secondary">{collapsed ? "Expand" : "Collapse"}</button>
              </div>
            </header>
            <div hidden={collapsed} className="border-t border-white/[.07] p-5 sm:p-6">{card.content}</div>
          </section>
        </div>;
      })}
      {organizing && dropIndex === preferences.order.length ? <div className="h-1 rounded-full bg-[var(--helios-orange)]" /> : null}
    </div>
  </div>;
}
