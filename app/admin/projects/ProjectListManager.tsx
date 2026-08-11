"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveSelectedProjects, moveSelectedProjectsByBoundary } from "@/lib/project-order";

export type AdminProjectListItem = {
  id: string; title: string; slug: string; shortDescription: string | null;
  location: string; status: string; featured: boolean; updatedAt: string;
  mediaCount: number; thumbnailUrl: string | null; thumbnailAlt: string;
};

function statusClasses(status: string) {
  if (status === "PUBLISHED") return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300";
  if (status === "ARCHIVED") return "border-white/10 bg-white/[0.04] text-white/45";
  return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";
}

function ProjectRow({ project, sortable, returnTo, selecting, selected, onSelect }: { project: AdminProjectListItem; sortable: boolean; returnTo: string; selecting: boolean; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, disabled: !sortable });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`border-b border-white/[0.07] last:border-0 ${isDragging ? "relative z-10 bg-[#181818] opacity-80" : ""}`}>
      <td className="w-20 py-4 pl-4">
        <div className="flex items-center gap-1">
          {selecting ? <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${project.title}`} className="h-4 w-4 accent-[var(--helios-orange)]" /> : null}
          <button type="button" disabled={!sortable} aria-label={`Move ${selected ? "selected projects including" : "project"} ${project.title}`} {...attributes} {...listeners} className="touch-none cursor-grab rounded-lg p-2 text-white/25 hover:bg-white/[0.05] hover:text-white disabled:cursor-default disabled:opacity-20">⋮⋮</button>
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex items-center gap-4">
          <Link href={`/admin/projects/${project.id}?returnTo=${encodeURIComponent(returnTo)}`} aria-label={`Edit ${project.title}`} className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] transition hover:border-[var(--helios-orange)]/60 focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]">
            {project.thumbnailUrl ? (
              <Image
                src={project.thumbnailUrl}
                alt={project.thumbnailAlt}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : <div className="flex h-full items-center justify-center text-white/20">▧</div>}
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-white">{project.title}</p>{project.featured ? <span className="rounded-full border border-[var(--helios-orange)]/30 px-2 py-1 text-[0.45rem] uppercase tracking-[0.12em] text-[var(--helios-orange)]">Featured</span> : null}</div>
            <p className="mt-1 text-xs text-white/30">/{project.slug}</p>
            {project.shortDescription ? <p className="mt-1 max-w-md truncate text-xs text-white/25">{project.shortDescription}</p> : null}
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-white/45">{project.location}</td>
      <td className="px-5 py-4 text-sm text-white/45">{project.mediaCount}</td>
      <td className="px-5 py-4"><span className={`rounded-full border px-3 py-1.5 text-[0.52rem] font-semibold uppercase tracking-[0.12em] ${statusClasses(project.status)}`}>{project.status.charAt(0) + project.status.slice(1).toLowerCase()}</span></td>
      <td className="px-5 py-4 text-sm text-white/35">{project.updatedAt}</td>
      <td className="sticky right-0 border-l border-white/[0.06] bg-[#111] px-5 py-4 text-right shadow-[-14px_0_24px_rgba(0,0,0,0.25)]"><div className="flex items-center justify-end gap-3">{project.status === "PUBLISHED" && <Link href={`/admin/portfolio-intelligence/${project.id}`} aria-label={`View Insights for ${project.title}`} className="admin-btn-link">Insights</Link>}<Link href={`/admin/projects/${project.id}?returnTo=${encodeURIComponent(returnTo)}`} className="admin-btn-link">Edit →</Link></div></td>
    </tr>
  );
}

export default function ProjectListManager({ initialProjects, allProjectIds, hasFilters, returnTo, rangeLabel }: { initialProjects: AdminProjectListItem[]; allProjectIds: string[]; hasFilters: boolean; pageStart: number; returnTo: string; rangeLabel: string }) {
  const [projects, setProjects] = useState(initialProjects);
  const [message, setMessage] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const sortable = !hasFilters && projects.length > 1;

  async function saveOrder(previous: AdminProjectListItem[], next: AdminProjectListItem[]) {
    const pageIds = new Set(initialProjects.map(({ id }) => id));
    const reorderedPageIds = next.map(({ id }) => id);
    let pageIndex = 0;
    const completeOrder = allProjectIds.map((id) => pageIds.has(id) ? reorderedPageIds[pageIndex++] : id);
    setProjects(next); setMessage("Saving project order…");
    try {
      const response = await fetch("/api/admin/projects/order", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectIds: completeOrder }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save project order.");
      setMessage("Project order saved. The portfolio now uses this order.");
    } catch (error) {
      setProjects(previous); setMessage(error instanceof Error ? error.message : "Unable to save project order.");
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const previous = projects;
    const activeId = String(active.id);
    const selection = selectedIds.has(activeId) ? selectedIds : new Set([activeId]);
    const next = selection.size > 1
      ? moveSelectedProjects(projects, selection, String(over.id))
      : arrayMove(projects, projects.findIndex((item) => item.id === active.id), projects.findIndex((item) => item.id === over.id));
    void saveOrder(previous, next);
  }

  function moveSelection(direction: "up" | "down" | "top" | "bottom") {
    if (!selectedIds.size) return;
    const previous = projects;
    const next = moveSelectedProjectsByBoundary(projects, selectedIds, direction);
    if (next.every((item, index) => item.id === previous[index]?.id)) return;
    void saveOrder(previous, next);
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return <>
    <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5 sm:px-6">
      <div><h2 className="text-2xl font-normal text-white">Portfolio projects</h2><p className="mt-1 text-sm text-white/35">{rangeLabel}{hasFilters ? " matching your filters" : " · drag rows to set the public portfolio order"}</p></div>
      <div className="flex flex-wrap items-center justify-end gap-3">{message ? <p role="status" className="max-w-sm text-right text-xs text-white/40">{message}</p> : null}<button type="button" disabled={hasFilters} onClick={() => { setSelecting((value) => !value); setSelectedIds(new Set()); }} className="admin-btn-secondary">{selecting ? "Done" : "Select"}</button></div>
    </div>
    {selecting && selectedIds.size ? <div role="toolbar" aria-label="Selected project ordering" className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-[var(--helios-orange)]/[0.05] px-5 py-3 sm:px-6"><span className="mr-2 text-xs text-white/55">{selectedIds.size} selected</span>{(["top", "up", "down", "bottom"] as const).map((direction) => <button key={direction} type="button" onClick={() => moveSelection(direction)} className="admin-btn-secondary">Move {direction}</button>)}<button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-white/40 hover:text-white">Clear selection</button></div> : null}
    {projects.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={projects.map((item) => item.id)} strategy={verticalListSortingStrategy}><div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left"><thead><tr className="border-b border-white/[0.07]"><th className="w-20"/><th className="px-3 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Project</th><th className="px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Location</th><th className="px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Media</th><th className="px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Status</th><th className="px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Updated</th><th className="sticky right-0 border-l border-white/[0.06] bg-[#111] px-5 py-4 text-right text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Actions</th></tr></thead><tbody>{projects.map((project) => <ProjectRow key={project.id} project={project} sortable={sortable} returnTo={returnTo} selecting={selecting} selected={selectedIds.has(project.id)} onSelect={() => toggleSelection(project.id)} />)}</tbody></table></div></SortableContext></DndContext> : <div className="px-6 py-16 text-center text-sm text-white/35">No projects match these filters.</div>}
  </>;
}
