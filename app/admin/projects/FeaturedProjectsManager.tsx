"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ProjectOption = { id: string; title: string; slug: string };

function FeaturedRow({ project, position, dropEdge, onRemove, disabled }: { project: ProjectOption; position: number; dropEdge: "before" | "after" | null; onRemove: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, disabled });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} className={`relative flex min-h-14 items-center gap-3 rounded-xl border bg-black/20 px-3 transition-colors ${isDragging ? "border-[var(--helios-orange)]/45 opacity-55 shadow-xl" : dropEdge ? "border-[var(--helios-orange)]/35" : "border-white/[0.08]"}`}>{dropEdge ? <span aria-hidden="true" className={`pointer-events-none absolute -left-1 -right-1 z-20 h-0.5 bg-[var(--helios-orange)] shadow-[0_0_12px_rgba(224,104,36,0.7)] ${dropEdge === "before" ? "-top-[5px]" : "-bottom-[5px]"}`}><span className="absolute -left-0.5 -top-[3px] h-2 w-2 rounded-full bg-[var(--helios-orange)]"/></span> : null}<button type="button" disabled={disabled} aria-label={`Move ${project.title}, currently position ${position}`} {...attributes} {...listeners} className="touch-none cursor-grab p-2 text-white/30 focus-visible:text-white active:cursor-grabbing">⋮⋮</button><span className="w-7 text-xs tabular-nums text-[var(--helios-orange)]">{position}</span><span className="min-w-0 flex-1 truncate text-sm text-white/65">{project.title}</span><Link href={`/portfolio/${project.slug}`} target="_blank" className="text-[0.5rem] uppercase tracking-[0.12em] text-white/30 hover:text-white">Preview</Link><button type="button" disabled={disabled} aria-label={`Remove ${project.title}`} onClick={onRemove} className="text-[0.5rem] uppercase tracking-[0.12em] text-red-200/45 hover:text-red-200">Remove</button></li>;
}

export default function FeaturedProjectsManager({ initialFeatured, candidates, overLimitCount, workspaceId, initialRevision }: { workspaceId: string; initialRevision: string; initialFeatured: ProjectOption[]; candidates: ProjectOption[]; overLimitCount: number }) {
  const busyRef = useRef(false);
  const reviewRef = useRef(false);
  const [revision, setRevision] = useState(initialRevision);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [selected, setSelected] = useState(initialFeatured.slice(0, 6));
  const [candidateId, setCandidateId] = useState("");
  const [replacement, setReplacement] = useState<{ incoming: ProjectOption; outgoingId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const replacementTriggerRef = useRef<HTMLButtonElement>(null);
  const replacementDialogRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const available = candidates.filter((project) => !selected.some(({ id }) => id === project.id));
  useEffect(() => {
    if (!replacement) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setReplacement(null); replacementTriggerRef.current?.focus(); return; }
      if (event.key !== "Tab") return;
      const focusable = replacementDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),select,[tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [replacement]);
  function addOrReplace() {
    if (busyRef.current || reviewRef.current) return;
    const incoming = available.find(({ id }) => id === candidateId);
    if (!incoming) return;
    if (selected.length < 6) { setSelected([...selected, incoming]); setCandidateId(""); return; }
    setReplacement({ incoming, outgoingId: selected[5].id });
  }
  function confirmReplacement() {
    if (!replacement || busyRef.current || reviewRef.current) return;
    setSelected(selected.map((project) => project.id === replacement.outgoingId ? replacement.incoming : project));
    setCandidateId(""); setReplacement(null); requestAnimationFrame(() => replacementTriggerRef.current?.focus());
  }
  function onDragStart(event: DragStartEvent) { if (busyRef.current || reviewRef.current) return; setActiveId(String(event.active.id)); setOverId(String(event.active.id)); }
  function onDragOver(event: DragOverEvent) { if (busyRef.current || reviewRef.current) return; setOverId(event.over ? String(event.over.id) : null); }
  function clearDragState() { setActiveId(null); setOverId(null); }
  function onDragEnd(event: DragEndEvent) {
    if (busyRef.current || reviewRef.current) { clearDragState(); return; }
    clearDragState();
    if (!event.over || event.active.id === event.over.id) return;
    setSelected((current) => {
      const oldIndex = current.findIndex(({ id }) => id === event.active.id);
      const newIndex = current.findIndex(({ id }) => id === event.over!.id);
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex);
    });
  }
  async function save() {
    if (busyRef.current || reviewRef.current || replacement) return;
    busyRef.current = true; setBusy(true); setMessage(null); clearDragState();
    const projectIds = selected.map(({ id }) => id);
    try {
      const response = await fetch("/api/admin/projects/featured", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectIds, expectedRevision: revision }) });
      const data = await response.json();
      if (!response.ok || data.success !== true || data.workspaceId !== workspaceId
        || !Array.isArray(data.projectIds) || data.projectIds.length !== projectIds.length || !data.projectIds.every((id: unknown, index: number) => id === projectIds[index])
        || typeof data.revision !== "string" || !/^[a-f0-9]{64}$/.test(data.revision) || data.revision === revision) throw new Error("Unconfirmed featured selection");
      setRevision(data.revision); setHasSaved(true); setMessage("Featured projects saved in the displayed order.");
    } catch {
      reviewRef.current = true; setReviewRequired(true);
      setMessage("The saved featured list needs review. Your selections remain here. Reload the saved list before making another change.");
    } finally { busyRef.current = false; setBusy(false); }
  }
  return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6"><div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow text-[var(--helios-orange)]">Featured Projects: {selected.length} of 6</p><h2 className="mt-2 text-2xl font-normal text-white">Featured project selection</h2><p className="mt-2 text-sm text-white/35">Drag projects into positions 1 through 6. Your changes take effect only after a confirmed save.</p></div><button type="button" disabled={busy || reviewRequired || Boolean(replacement)} onClick={() => void save()} className="admin-btn-primary">{busy ? "Saving…" : "Save Featured Projects"}</button></div>
    {overLimitCount > 6 && !hasSaved && !reviewRequired ? <div role="alert" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100/70"><p>More than 6 projects are currently featured. The first six below are live. Select and save the six that should remain. All {overLimitCount} existing choices remain available until then.</p><p className="mt-3 text-xs text-amber-100/50">Additional featured records: {initialFeatured.slice(6).map(({ title }) => title).join(", ")}</p></div> : null}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragCancel={clearDragState} onDragEnd={onDragEnd}><SortableContext items={selected.map(({ id }) => id)} strategy={rectSortingStrategy}><ol className="mt-5 grid gap-3 lg:grid-cols-2">{selected.map((project, index) => { const activeIndex = selected.findIndex(({ id }) => id === activeId); const dropEdge = overId === project.id && activeId !== overId && activeIndex >= 0 ? (activeIndex > index ? "before" : "after") : null; return <FeaturedRow key={project.id} project={project} position={index + 1} dropEdge={dropEdge} disabled={busy || reviewRequired} onRemove={() => { if (!busyRef.current && !reviewRef.current) setSelected(selected.filter(({ id }) => id !== project.id)); }}/>; })}</ol></SortableContext></DndContext>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row"><select aria-label="Published project to feature" disabled={busy || reviewRequired} value={candidateId} onChange={(event) => setCandidateId(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white"><option value="">Select a published project</option>{available.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button ref={replacementTriggerRef} type="button" disabled={!candidateId || busy || reviewRequired} onClick={addOrReplace} className="admin-btn-secondary">{selected.length >= 6 ? "Replace a Featured Project" : "Add Featured Project"}</button></div>
    {reviewRequired ? <div role="alert" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4"><h3 className="text-sm font-medium text-amber-100">Review saved featured projects</h3><p className="mt-2 text-sm text-white/65">This is your retained selection. The saved order may differ.</p><button type="button" className="admin-btn-secondary mt-3" onClick={() => { if (window.confirm("Reload the saved featured list? Unsaved changes on this page will be discarded.")) window.location.reload(); }}>Review saved featured list</button></div> : null}
    {message ? <p role="status" className="mt-4 text-xs text-white/45">{message}</p> : null}
    {replacement ? <div ref={replacementDialogRef} role="dialog" aria-modal="true" aria-labelledby="replace-featured-title" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-5"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6"><h3 id="replace-featured-title" className="text-xl text-white">Replace a Featured Project</h3><p className="mt-3 text-sm leading-6 text-white/45">Add <strong className="text-white/75">{replacement.incoming.title}</strong> and remove the selected project below. This requires confirmation.</p><label className="mt-5 block text-[0.55rem] uppercase tracking-[0.14em] text-white/35">Project to remove<select autoFocus value={replacement.outgoingId} onChange={(event) => setReplacement({ ...replacement, outgoingId: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black px-4 text-sm text-white">{selected.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setReplacement(null); requestAnimationFrame(() => replacementTriggerRef.current?.focus()); }} className="admin-btn-secondary">Cancel</button><button type="button" onClick={confirmReplacement} className="admin-btn-primary">Confirm Replacement</button></div></div></div> : null}
  </section>;
}
