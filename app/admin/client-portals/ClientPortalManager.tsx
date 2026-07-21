"use client";

import { useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Portal = {
  id: string; name: string; slug: string; description: string | null; provider: "HDPHOTOHUB" | "EXTERNAL";
  hdphGroupId: number | null; loginUrl: string | null; registrationUrl: string | null; bookingUrl: string | null;
  registrationEnabled: boolean; isDefault: boolean; active: boolean; displayOrder: number;
};
type Group = { gid: number; name: string };
type Draft = Omit<Portal, "id" | "displayOrder"> & { id?: string };

const emptyDraft: Draft = { name: "", slug: "", description: "", provider: "HDPHOTOHUB", hdphGroupId: null, loginUrl: "", registrationUrl: "", bookingUrl: "", registrationEnabled: true, isDefault: false, active: true };

function SortablePortalRow({ portal, disabled, onEdit, onRemove }: { portal: Portal; disabled: boolean; onEdit: (portal: Portal) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: portal.id, disabled });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between ${isDragging ? "relative z-10 bg-[#181818] opacity-80" : ""}`}><div className="flex min-w-0 items-start gap-4"><button type="button" disabled={disabled} aria-label={`Move ${portal.name}`} {...attributes} {...listeners} className="touch-none cursor-grab rounded-lg px-2 py-1 text-lg text-white/25 hover:bg-white/[0.05] hover:text-white disabled:cursor-default disabled:opacity-20">⋮⋮</button><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg text-white">{portal.name}</h3>{portal.isDefault && <span className="rounded-full border border-[var(--helios-orange)]/30 px-2 py-1 text-[0.55rem] uppercase tracking-[0.15em] text-[var(--helios-orange)]">Default</span>}{!portal.active && <span className="text-[0.58rem] uppercase tracking-[0.15em] text-white/25">Hidden</span>}</div><p className="mt-1 text-xs text-white/30">/client-portal/{portal.slug} · {portal.provider === "HDPHOTOHUB" ? (portal.hdphGroupId ? `HDPhotoHub group #${portal.hdphGroupId}` : "HDPhotoHub — general") : "External provider"}</p></div></div><div className="flex gap-4"><button onClick={() => onEdit(portal)} className="text-xs uppercase tracking-[0.16em] text-white/50 hover:text-white">Edit</button><button onClick={() => onRemove(portal.id)} className="text-xs uppercase tracking-[0.16em] text-red-300/50 hover:text-red-300">Delete</button></div></article>;
}

export default function ClientPortalManager({ initialPortals }: { initialPortals: Portal[] }) {
  const [portals, setPortals] = useState(initialPortals);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [groups, setGroups] = useState<Group[]>([]);
  const [brand, setBrand] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("Test the connection to discover every current HDPhotoHub group.");
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const editing = Boolean(draft.id);
  const selectedGroup = useMemo(() => groups.find((group) => group.gid === draft.hdphGroupId), [draft.hdphGroupId, groups]);

  const field = (key: keyof Draft, value: string | boolean | number | null) => setDraft((current) => ({ ...current, [key]: value }));

  async function discoverGroups() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/client-portals/connection", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setBrand(result.brand?.name ?? "HDPhotoHub"); setGroups(result.groups ?? []); setEmailConfigured(Boolean(result.emailConfigured));
      setConnectionMessage(`${result.groups.length} groups discovered. Refresh this list whenever groups change in HDPhotoHub.`);
    } catch (error) { setConnectionMessage(error instanceof Error ? error.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/client-portals", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPortals((current) => editing ? current.map((portal) => portal.id === result.portal.id ? result.portal : (result.portal.isDefault ? { ...portal, isDefault: false } : portal)) : [...current.map((portal) => result.portal.isDefault ? { ...portal, isDefault: false } : portal), result.portal]);
      setDraft(emptyDraft); setMessage(editing ? "Portal updated." : "Portal created.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The portal could not be saved."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this client portal? Existing HDPhotoHub accounts will not be changed.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/client-portals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("The portal could not be deleted.");
      setPortals((current) => current.filter((portal) => portal.id !== id));
      if (draft.id === id) setDraft(emptyDraft);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Delete failed."); }
    finally { setBusy(false); }
  }

  function edit(portal: Portal) { setDraft({ ...portal }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function reorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || busy) return;
    const previous = portals;
    const next = arrayMove(portals, portals.findIndex(({ id }) => id === active.id), portals.findIndex(({ id }) => id === over.id)).map((portal, displayOrder) => ({ ...portal, displayOrder }));
    setPortals(next); setBusy(true); setMessage("Saving portal order…");
    try {
      const response = await fetch("/api/admin/client-portals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reorder", portalIds: next.map(({ id }) => id) }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The portal order could not be saved.");
      setMessage("Portal order saved. The client login page now uses this order.");
    } catch (error) { setPortals(previous); setMessage(error instanceof Error ? error.message : "The portal order could not be saved."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="eyebrow text-[var(--helios-orange)]">HDPhotoHub connection</p><h2 className="mt-3 text-2xl text-white">{brand || "Discover client groups"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">{connectionMessage}</p>{emailConfigured === false && <p className="mt-2 text-xs text-amber-200/70">Group discovery is ready. Secure portal emails also require RESEND_API_KEY and PORTAL_EMAIL_FROM.</p>}</div>
        <button type="button" disabled={busy} onClick={discoverGroups} className="admin-btn-secondary">{busy ? "Connecting…" : groups.length ? "Refresh groups" : "Test & discover"}</button>
      </div>
    </section>

    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="flex items-end justify-between gap-5"><div><p className="eyebrow text-[var(--helios-orange)]">{editing ? "Edit portal" : "New portal"}</p><h2 className="mt-3 text-2xl text-white">Map a branded entry point</h2></div>{editing && <button type="button" onClick={() => setDraft(emptyDraft)} className="text-xs uppercase tracking-[0.16em] text-white/40 hover:text-white">Cancel edit</button>}</div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-white/35">Portal name<input value={draft.name} onChange={(event) => field("name", event.target.value)} placeholder="RE/MAX Alliance — Fort Collins" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
        <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-white/35">URL slug<input value={draft.slug} onChange={(event) => field("slug", event.target.value)} placeholder="remax-fort-collins" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
        <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-white/35">Provider<select value={draft.provider} onChange={(event) => field("provider", event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm normal-case tracking-normal text-white outline-none"><option value="HDPHOTOHUB">HDPhotoHub API</option><option value="EXTERNAL">External portal link</option></select></label>
        {draft.provider === "HDPHOTOHUB" ? <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-white/35">HDPhotoHub group<select value={draft.hdphGroupId ?? ""} onChange={(event) => field("hdphGroupId", event.target.value ? Number(event.target.value) : null)} className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm normal-case tracking-normal text-white outline-none"><option value="">General / any client group</option>{groups.map((group) => <option key={group.gid} value={group.gid}>{group.name}</option>)}{draft.hdphGroupId && !selectedGroup && <option value={draft.hdphGroupId}>Saved group #{draft.hdphGroupId}</option>}</select></label> : <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-white/35">External login URL<input value={draft.loginUrl ?? ""} onChange={(event) => field("loginUrl", event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none" /></label>}
        <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-white/35 lg:col-span-2">Description<textarea value={draft.description ?? ""} onChange={(event) => field("description", event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case leading-6 tracking-normal text-white outline-none" /></label>
        {draft.provider === "EXTERNAL" && <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-white/35">External registration URL<input value={draft.registrationUrl ?? ""} onChange={(event) => field("registrationUrl", event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none" /></label>}
        <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-white/35">Booking cart URL<input value={draft.bookingUrl ?? ""} onChange={(event) => field("bookingUrl", event.target.value)} placeholder="Optional custom booking cart" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none" /></label>
      </div>
      <div className="mt-5 flex flex-wrap gap-5 text-sm text-white/55">{[["active", "Visible"], ["registrationEnabled", "Allow account creation"], ["isDefault", "Default portal"]].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(draft[key as keyof Draft])} onChange={(event) => field(key as keyof Draft, event.target.checked)} className="accent-[var(--helios-orange)]" />{label}</label>)}</div>
      <div className="mt-6 flex items-center gap-4"><button type="button" disabled={busy || !draft.name.trim()} onClick={save} className="admin-btn-primary">{editing ? "Save portal" : "Create portal"}</button>{message && <p className="text-sm text-white/45">{message}</p>}</div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"><div className="flex flex-col gap-2 border-b border-white/[0.08] px-6 py-5 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl text-white">Client entry points</h2><p className="mt-1 text-sm text-white/35">{portals.length} configured portals · drag rows to set the public display order</p></div>{message && <p role="status" className="text-xs text-white/40">{message}</p>}</div>{portals.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}><SortableContext items={portals.map(({ id }) => id)} strategy={verticalListSortingStrategy}><div className="divide-y divide-white/[0.07]">{portals.map((portal) => <SortablePortalRow key={portal.id} portal={portal} disabled={busy} onEdit={edit} onRemove={remove} />)}</div></SortableContext></DndContext> : <p className="px-6 py-10 text-sm text-white/35">No portals yet. Discover the HDPhotoHub groups, then create the first entry point.</p>}</section>
  </div>;
}
