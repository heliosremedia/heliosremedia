"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AdminCardIconButton, AdminDragHandle } from "@/app/admin/components/AdminCardControls";
import {
  createEmailStudioLayoutStore,
  emailStudioLayoutStorageKey,
  moveEmailStudioCard,
  resetEmailStudioCardOrder,
  type EmailStudioCardId,
} from "@/lib/email-studio-layout";

export type EmailStudioCard = { id: EmailStudioCardId; label: string; content: ReactNode };
type DropTarget = { id: EmailStudioCardId; after: boolean };

export default function EmailStudioCardOrganizer({ workspaceId, userId, cards }: {
  workspaceId: string;
  userId: string;
  cards: EmailStudioCard[];
}) {
  const storageKey = emailStudioLayoutStorageKey(workspaceId, userId);
  // Changing accounts/workspaces must also clear transient drag and status state.
  return <EmailStudioCardList key={storageKey} storageKey={storageKey} cards={cards} />;
}

function EmailStudioCardList({ storageKey, cards }: { storageKey: string; cards: EmailStudioCard[] }) {
  const store = useMemo(() => createEmailStudioLayoutStore(storageKey, () => window.localStorage), [storageKey]);
  const { order, storageAvailable } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [organizing, setOrganizing] = useState(false);
  const [draggedId, setDraggedId] = useState<EmailStudioCardId | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [message, setMessage] = useState("");
  const cardRefs = useRef<Partial<Record<EmailStudioCardId, HTMLDivElement | null>>>({});
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const visibleOrder = order.filter((id) => cardsById.has(id));
  const defaultOrder = resetEmailStudioCardOrder(order, visibleOrder);
  const isDefault = order.join() === defaultOrder.join();

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) store.refresh();
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey, store]);

  function move(id: EmailStudioCardId, targetIndex: number) {
    const next = moveEmailStudioCard(order, visibleOrder, id, targetIndex);
    if (next.join() === order.join()) return;
    const saved = store.save(next);
    setMessage(`${cardsById.get(id)?.label} moved to position ${targetIndex + 1} of ${visibleOrder.length}.${saved ? "" : " Order changed for this visit only; browser storage is unavailable."}`);
    requestAnimationFrame(() => cardRefs.current[id]?.focus({ preventScroll: true }));
  }

  function clearDrag() {
    setDraggedId(null);
    setDropTarget(null);
  }

  return <div className="mb-7 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="px-2 text-xs text-white/45">
        <p>{storageAvailable ? "Card order is saved for your account and workspace on this browser." : "Browser storage is unavailable. Card order will last for this visit only."}</p>
        {organizing && <p id="email-studio-sort-help" className="mt-1">Drag a handle or use the up/down buttons. With a card focused, use Alt + ↑ or ↓.</p>}
        <p role="status" aria-live="polite" aria-atomic="true" className={message ? "mt-1" : "sr-only"}>{message}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={organizing} aria-controls="email-studio-cards" onClick={() => { setOrganizing((value) => !value); clearDrag(); }} className={organizing ? "admin-btn-primary" : "admin-btn-secondary"}>{organizing ? "Done organizing" : "Organize cards"}</button>
        {organizing && <button type="button" disabled={isDefault} onClick={() => {
          const saved = store.save(defaultOrder);
          clearDrag();
          setMessage(`Default card order restored.${saved ? "" : " Browser storage is unavailable; this change lasts for this visit only."}`);
        }} className="admin-btn-secondary">Reset order</button>}
      </div>
    </div>
    <div id="email-studio-cards" className="space-y-7">
      {visibleOrder.map((id, index) => {
        const card = cardsById.get(id)!;
        return <div
          key={id}
          ref={(node) => { cardRefs.current[id] = node; }}
          data-email-studio-card={id}
          role="group"
          aria-label={`${card.label}, position ${index + 1} of ${visibleOrder.length}`}
          aria-describedby={organizing ? "email-studio-sort-help" : undefined}
          tabIndex={organizing ? 0 : -1}
          onKeyDown={(event) => {
            if (!organizing || !event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
            event.preventDefault();
            move(id, index + (event.key === "ArrowUp" ? -1 : 1));
          }}
          onDragOver={(event) => {
            if (!organizing || !draggedId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const bounds = event.currentTarget.getBoundingClientRect();
            setDropTarget({ id, after: event.clientY > bounds.top + bounds.height / 2 });
          }}
          onDrop={(event) => {
            if (!organizing || !draggedId || !dropTarget || dropTarget.id !== id) return;
            event.preventDefault();
            const insertionIndex = index + (dropTarget.after ? 1 : 0);
            const sourceIndex = visibleOrder.indexOf(draggedId);
            move(draggedId, insertionIndex - (sourceIndex < insertionIndex ? 1 : 0));
            clearDrag();
          }}
          className={`relative min-w-0 rounded-2xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] ${draggedId === id ? "opacity-60" : ""}`}
        >
          {organizing && dropTarget?.id === id && <div aria-hidden="true" className={`pointer-events-none absolute -inset-x-1 h-1 rounded-full bg-[var(--helios-orange)] ${dropTarget.after ? "-bottom-4" : "-top-4"}`} />}
          {organizing && <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-xs text-white/45">{card.label} · {index + 1} of {visibleOrder.length}</p>
            <div className="flex items-center gap-2">
              <AdminDragHandle label={card.label} draggable onDragStart={(event) => {
                setDraggedId(id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", id);
              }} onDragEnd={clearDrag} />
              <AdminCardIconButton label={`Move ${card.label} up`} symbol="↑" disabled={index === 0} onClick={() => move(id, index - 1)} />
              <AdminCardIconButton label={`Move ${card.label} down`} symbol="↓" disabled={index === visibleOrder.length - 1} onClick={() => move(id, index + 1)} />
            </div>
          </div>}
          {card.content}
        </div>;
      })}
    </div>
  </div>;
}
