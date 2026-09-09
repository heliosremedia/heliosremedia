"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ProjectOption = { id: string; title: string; slug: string };

function FeaturedRow({ project, position, onRemove }: { project: ProjectOption; position: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: project.id });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3"><button type="button" aria-label={`Move ${project.title}`} {...attributes} {...listeners} className="touch-none cursor-grab p-2 text-white/30">⋮⋮</button><span className="w-7 text-xs tabular-nums text-[var(--helios-orange)]">{position}</span><span className="min-w-0 flex-1 truncate text-sm text-white/65">{project.title}</span><Link href={`/portfolio/${project.slug}`} target="_blank" className="text-[0.5rem] uppercase tracking-[0.12em] text-white/30 hover:text-white">Preview</Link><button type="button" onClick={onRemove} className="text-[0.5rem] uppercase tracking-[0.12em] text-red-200/45 hover:text-red-200">Remove</button></li>;
}

export default function FeaturedProjectsManager({ initialFeatured, candidates, overLimitCount }: { initialFeatured: ProjectOption[]; candidates: ProjectOption[]; overLimitCount: number }) {
  const [selected, setSelected] = useState(initialFeatured.slice(0, 6));
  const [candidateId, setCandidateId] = useState("");
  const [replacement, setReplacement] = useState<{ incoming: ProjectOption; outgoingId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    const incoming = available.find(({ id }) => id === candidateId);
    if (!incoming) return;
    if (selected.length < 6) { setSelected([...selected, incoming]); setCandidateId(""); return; }
    setReplacement({ incoming, outgoingId: selected[5].id });
  }
  function confirmReplacement() {
    if (!replacement) return;
    setSelected(selected.map((project) => project.id === replacement.outgoingId ? replacement.incoming : project));
    setCandidateId(""); setReplacement(null); requestAnimationFrame(() => replacementTriggerRef.current?.focus());
  }
  function onDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    setSelected((current) => arrayMove(current, current.findIndex(({ id }) => id === event.active.id), current.findIndex(({ id }) => id === event.over!.id)));
  }
  async function save() {
    setBusy(true); setMessage("Saving featured projects…");
    try { const response = await fetch("/api/admin/projects/featured", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectIds: selected.map(({ id }) => id) }) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "Unable to save featured projects."); setMessage("Featured project order saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save featured projects."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6"><div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow text-[var(--helios-orange)]">Featured Projects: {selected.length} of 6</p><h2 className="mt-2 text-2xl font-normal text-white">Public featured order</h2><p className="mt-2 text-sm text-white/35">Drag projects into positions 1 through 6. Nothing is removed until you save.</p></div><button type="button" disabled={busy} onClick={() => void save()} className="admin-btn-primary">{busy ? "Saving…" : "Save Featured Projects"}</button></div>
    {overLimitCount > 6 ? <div role="alert" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100/70"><p>More than 6 projects are currently featured. The first six below are live. Select and save the six that should remain. All {overLimitCount} existing choices remain available until then.</p><p className="mt-3 text-xs text-amber-100/50">Additional featured records: {initialFeatured.slice(6).map(({ title }) => title).join(", ")}</p></div> : null}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={selected.map(({ id }) => id)} strategy={verticalListSortingStrategy}><ol className="mt-5 grid gap-2 lg:grid-cols-2">{selected.map((project, index) => <FeaturedRow key={project.id} project={project} position={index + 1} onRemove={() => setSelected(selected.filter(({ id }) => id !== project.id))}/>)}</ol></SortableContext></DndContext>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row"><select value={candidateId} onChange={(event) => setCandidateId(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white"><option value="">Select a published project</option>{available.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button ref={replacementTriggerRef} type="button" disabled={!candidateId} onClick={addOrReplace} className="admin-btn-secondary">{selected.length >= 6 ? "Replace a Featured Project" : "Add Featured Project"}</button></div>
    {message ? <p role="status" className="mt-4 text-xs text-white/45">{message}</p> : null}
    {replacement ? <div ref={replacementDialogRef} role="dialog" aria-modal="true" aria-labelledby="replace-featured-title" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-5"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6"><h3 id="replace-featured-title" className="text-xl text-white">Replace a Featured Project</h3><p className="mt-3 text-sm leading-6 text-white/45">Add <strong className="text-white/75">{replacement.incoming.title}</strong> and remove the selected project below. This requires confirmation.</p><label className="mt-5 block text-[0.55rem] uppercase tracking-[0.14em] text-white/35">Project to remove<select autoFocus value={replacement.outgoingId} onChange={(event) => setReplacement({ ...replacement, outgoingId: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black px-4 text-sm text-white">{selected.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setReplacement(null); requestAnimationFrame(() => replacementTriggerRef.current?.focus()); }} className="admin-btn-secondary">Cancel</button><button type="button" onClick={confirmReplacement} className="admin-btn-primary">Confirm Replacement</button></div></div></div> : null}
  </section>;
}
