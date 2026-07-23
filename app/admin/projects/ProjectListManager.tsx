"use client";

import { useState } from "react";
import Link from "next/link";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

function ProjectRow({ project, sortable, returnTo }: { project: AdminProjectListItem; sortable: boolean; returnTo: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, disabled: !sortable });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`border-b border-white/[0.07] last:border-0 ${isDragging ? "relative z-10 bg-[#181818] opacity-80" : ""}`}>
      <td className="w-12 py-4 pl-4">
        <button type="button" disabled={!sortable} aria-label={`Move ${project.title}`} {...attributes} {...listeners} className="touch-none cursor-grab rounded-lg p-2 text-white/25 hover:bg-white/[0.05] hover:text-white disabled:cursor-default disabled:opacity-20">⋮⋮</button>
      </td>
      <td className="px-3 py-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03]">
            {project.thumbnailUrl ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={project.thumbnailUrl} alt={project.thumbnailAlt} className="h-full w-full object-cover" />
            </> : <div className="flex h-full items-center justify-center text-white/20">▧</div>}
          </div>
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
      <td className="px-5 py-4 text-right"><Link href={`/admin/projects/${project.id}?returnTo=${encodeURIComponent(returnTo)}`} className="admin-btn-link">Edit →</Link></td>
    </tr>
  );
}

export default function ProjectListManager({ initialProjects, hasFilters, pageStart, returnTo, rangeLabel }: { initialProjects: AdminProjectListItem[]; hasFilters: boolean; pageStart: number; returnTo: string; rangeLabel: string }) {
  const [projects, setProjects] = useState(initialProjects);
  const [message, setMessage] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const sortable = !hasFilters && projects.length > 1;

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const previous = projects;
    const next = arrayMove(projects, projects.findIndex((item) => item.id === active.id), projects.findIndex((item) => item.id === over.id));
    setProjects(next); setMessage("Saving project order…");
    try {
      const response = await fetch("/api/admin/projects/order", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectIds: next.map((item) => item.id), startingDisplayOrder: pageStart }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save project order.");
      setMessage("Project order saved. The portfolio now uses this order.");
    } catch (error) {
      setProjects(previous); setMessage(error instanceof Error ? error.message : "Unable to save project order.");
    }
  }

  return <>
    <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5 sm:px-6">
      <div><h2 className="text-2xl font-normal text-white">Portfolio projects</h2><p className="mt-1 text-sm text-white/35">{rangeLabel}{hasFilters ? " matching your filters" : " · drag rows to set the public portfolio order"}</p></div>
      {message ? <p role="status" className="max-w-sm text-right text-xs text-white/40">{message}</p> : null}
    </div>
    {projects.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={projects.map((item) => item.id)} strategy={verticalListSortingStrategy}><div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left"><thead><tr className="border-b border-white/[0.07]"><th className="w-12"/><th className="px-3 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Project</th><th className="px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Location</th><th className="px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Media</th><th className="px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Status</th><th className="px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">Updated</th><th className="px-5 py-4"/></tr></thead><tbody>{projects.map((project) => <ProjectRow key={project.id} project={project} sortable={sortable} returnTo={returnTo} />)}</tbody></table></div></SortableContext></DndContext> : <div className="px-6 py-16 text-center text-sm text-white/35">No projects match these filters.</div>}
  </>;
}
