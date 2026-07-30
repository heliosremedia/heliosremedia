"use client";

import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  normalizeDashboardPreferences,
  type DashboardCardId,
  type DashboardPreferences,
} from "@/lib/dashboard-layout";

type Card = { id: DashboardCardId; title: string; summary?: string; content: ReactNode };
type DropTarget = { row: number; side: "before" | "after" | "beside" };

export default function DashboardOrganizer({ initialPreferences, cards }: {
  initialPreferences: DashboardPreferences;
  cards: Card[];
}) {
  const [preferences, setPreferences] = useState(() => normalizeDashboardPreferences(initialPreferences));
  const [organizing, setOrganizing] = useState(false);
  const [dragged, setDragged] = useState<DashboardCardId | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const refs = useRef<Partial<Record<DashboardCardId, HTMLButtonElement | null>>>({});
  const byId = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards]);

  async function persist(value: DashboardPreferences, success: string) {
    const next = normalizeDashboardPreferences(value);
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

  function saveRows(rows: DashboardCardId[][], success: string) {
    void persist({ ...preferences, rows, order: rows.flat() }, success);
  }

  function removeFromRows(id: DashboardCardId) {
    return preferences.rows.map(row => row.filter(item => item !== id)).filter(row => row.length);
  }

  function moveToRow(id: DashboardCardId, targetRow: number, side: DropTarget["side"]) {
    const rows = removeFromRows(id);
    const safeRow = Math.max(0, Math.min(targetRow, rows.length));
    if (side === "beside" && rows[safeRow]?.length === 1) rows[safeRow].push(id);
    else rows.splice(side === "after" ? safeRow + 1 : safeRow, 0, [id]);
    saveRows(rows, `${byId.get(id)?.title} moved to ${side === "beside" ? "a two-column row" : "a full-width row"}.`);
    refs.current[id]?.focus();
  }

  function moveRow(id: DashboardCardId, direction: -1 | 1) {
    const rowIndex = preferences.rows.findIndex(row => row.includes(id));
    const rows = removeFromRows(id);
    rows.splice(Math.max(0, Math.min(rowIndex + direction, rows.length)), 0, [id]);
    saveRows(rows, `${byId.get(id)?.title} moved ${direction < 0 ? "up" : "down"}.`);
    refs.current[id]?.focus();
  }

  function pairWithPrevious(id: DashboardCardId) {
    const rowIndex = preferences.rows.findIndex(row => row.includes(id));
    if (rowIndex <= 0 || preferences.rows[rowIndex - 1].length !== 1) return;
    moveToRow(id, rowIndex - 1, "beside");
  }

  function toggle(id: DashboardCardId) {
    const collapsed = preferences.collapsed.includes(id)
      ? preferences.collapsed.filter(item => item !== id)
      : [...preferences.collapsed, id];
    void persist({ ...preferences, collapsed }, `${byId.get(id)?.title} ${collapsed.includes(id) ? "collapsed" : "expanded"}.`);
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.08] bg-white/[.02] p-3">
      <p role="status" aria-live="polite" className="px-2 text-xs text-white/40">{message || (organizing ? "Drag by a handle or use the row and column controls." : "Dashboard layout saved per account.")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOrganizing(value => !value)} className={organizing ? "admin-btn-primary" : "admin-btn-secondary"}>{organizing ? "Done Organizing" : "Organize Dashboard"}</button>
        <button type="button" disabled={saving} onClick={() => void persist({ ...preferences, collapsed: [] }, "All dashboard cards expanded.")} className="admin-btn-secondary">Expand All</button>
        <button type="button" disabled={saving} onClick={() => void persist({ ...preferences, collapsed: [...preferences.order] }, "All dashboard cards collapsed.")} className="admin-btn-secondary">Collapse All</button>
        <button type="button" disabled={saving} onClick={() => confirm("Reset dashboard rows and collapsed cards?") && void persist(DEFAULT_DASHBOARD_PREFERENCES, "Default dashboard layout restored.")} className="admin-btn-secondary">Reset Layout</button>
      </div>
    </div>
    <div className="space-y-4">
      {preferences.rows.map((row, rowIndex) => <div key={row.join(":")} className="relative">
        {organizing && dropTarget?.row === rowIndex && dropTarget.side === "before" ? <div className="mb-3 h-1 rounded-full bg-[var(--helios-orange)] shadow-[0_0_16px_rgba(217,107,43,.8)]" /> : null}
        <div
          className={`grid gap-4 ${row.length === 2 ? "lg:grid-cols-2" : "grid-cols-1"}`}
          onDragOver={event => { if (!organizing) return; event.preventDefault(); setDropTarget({ row: rowIndex, side: row.length === 1 ? "beside" : "after" }); }}
          onDrop={event => { event.preventDefault(); if (dragged && dropTarget) moveToRow(dragged, dropTarget.row, dropTarget.side); setDragged(null); setDropTarget(null); }}
        >
          {row.map(id => {
            const card = byId.get(id); if (!card) return null;
            const collapsed = preferences.collapsed.includes(id);
            return <section key={id} className={`min-w-0 overflow-hidden rounded-2xl border bg-[#111] transition ${dragged === id ? "scale-[.99] border-[var(--helios-orange)]/50 opacity-60" : dropTarget?.row === rowIndex && dropTarget.side === "beside" && row.length === 1 ? "border-[var(--helios-orange)]/60" : "border-white/[.08]"}`}>
              <header className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <button ref={node => { refs.current[id] = node; }} type="button" onClick={() => toggle(id)} aria-expanded={!collapsed} className="text-left text-xl font-light text-white focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]">{card.title}</button>
                  {collapsed && card.summary ? <p className="mt-2 truncate text-xs text-white/35">{card.summary}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {organizing ? <>
                    <span draggable onDragStart={(event: DragEvent<HTMLSpanElement>) => { setDragged(id); event.dataTransfer.setData("text/plain", id); }} onDragEnd={() => { setDragged(null); setDropTarget(null); }} className="cursor-grab rounded-xl border border-white/10 px-4 py-2 text-white/40" role="button" tabIndex={0} aria-label={`Drag ${card.title}`}>⠿</span>
                    <button type="button" disabled={rowIndex === 0 || saving} onClick={() => moveRow(id, -1)} className="admin-btn-secondary">Move Up</button>
                    <button type="button" disabled={rowIndex === preferences.rows.length - 1 || saving} onClick={() => moveRow(id, 1)} className="admin-btn-secondary">Move Down</button>
                    {row.length === 2 ? <button type="button" onClick={() => moveToRow(id, rowIndex, "after")} className="admin-btn-secondary">Full Width</button>
                      : <button type="button" disabled={rowIndex === 0 || preferences.rows[rowIndex - 1]?.length !== 1} onClick={() => pairWithPrevious(id)} className="admin-btn-secondary">Place Beside Above</button>}
                  </> : null}
                  <button type="button" onClick={() => toggle(id)} className="admin-btn-secondary">{collapsed ? "Expand" : "Collapse"}</button>
                </div>
              </header>
              <div hidden={collapsed} className="border-t border-white/[.07] p-5 sm:p-6">{card.content}</div>
            </section>;
          })}
        </div>
        {organizing && dropTarget?.row === rowIndex && dropTarget.side === "after" ? <div className="mt-3 h-1 rounded-full bg-[var(--helios-orange)] shadow-[0_0_16px_rgba(217,107,43,.8)]" /> : null}
      </div>)}
    </div>
  </div>;
}
