"use client";

import { useRef, type ReactNode } from "react";

type WorkspaceTab<Id extends string> = {
  id: Id;
  label: string;
  badge?: ReactNode;
};

/** Shared task-first navigation. Panels stay mounted in the owning workspace. */
export default function AdminWorkspaceTabs<Id extends string>({ idPrefix, label, items, value, onChange }: {
  idPrefix: string;
  label: string;
  items: readonly WorkspaceTab<Id>[];
  value: Id;
  onChange: (id: Id) => void;
}) {
  const buttons = useRef(new Map<Id, HTMLButtonElement>());
  return <div id={`${idPrefix}-tabs`} className="admin-workspace-tabs" role="tablist" aria-label={label}>
    {items.map((item, index) => <button
      key={item.id}
      ref={(button) => { if (button) buttons.current.set(item.id, button); else buttons.current.delete(item.id); }}
      id={`${idPrefix}-tab-${item.id}`}
      type="button"
      role="tab"
      aria-selected={value === item.id}
      aria-controls={`${idPrefix}-panel-${item.id}`}
      tabIndex={value === item.id ? 0 : -1}
      onClick={() => onChange(item.id)}
      onKeyDown={(event) => {
        const nextIndex = event.key === "ArrowRight" ? (index + 1) % items.length
          : event.key === "ArrowLeft" ? (index + items.length - 1) % items.length
            : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
        if (nextIndex === null) return;
        event.preventDefault();
        const next = items[nextIndex].id;
        onChange(next);
        buttons.current.get(next)?.focus();
      }}
    >{item.label}{item.badge}</button>)}
  </div>;
}
