"use client";
import { useState } from "react";

import { useCurationRecovery } from "./useCurationRecovery";
import { record, sameMembers, mergeDraft, normalized } from "@/lib/homepage-curation-editor";

export type ProjectOption = { id: string; title: string; slug: string };
export type Placement = { id: string; projectId: string; titleOverride: string | null; displayOrder: number; active: boolean; imageUrl: string | null; project: { title: string; slug: string; status: string; locationLabel: string | null; heroMedia: { storageKey: string | null; altText: string | null } | null } };

export default function HomepageProjectManager({ initialPlacements, projects, workspaceId, initialRevision }: { workspaceId: string; initialRevision: string; initialPlacements: Placement[]; projects: ProjectOption[] }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const recovery = useCurationRecovery('projects', workspaceId, initialRevision, { placements: initialPlacements, selected: '' });
  const snapshot = recovery.draft, { placements, selected } = snapshot;
  const setPlacements = (update: (rows: Placement[]) => Placement[]) => recovery.setDraft(current => ({ ...current, placements: update(current.placements) }));
  const setSelected = (update: string | ((value: string) => string)) => recovery.setDraft(current => ({ ...current, selected: typeof update === 'function' ? update(current.selected) : update }));
  const available = projects.filter(project => !placements.some(item => item.projectId === project.id));
  const locked = busy || recovery.blocked;
  async function change(method: string, body: Record<string, unknown>, item?: Placement) {
    const token = recovery.begin(snapshot, { method, body }); if (!token) return;
    setBusy(true); setError(null);
    const ids = placements.map(row => row.id);
    const data = await recovery.mutate(token, '/api/admin/homepage-projects' + (method === 'DELETE' ? `?placementId=${encodeURIComponent(item!.id)}` : ''), { method, body: method === 'DELETE' ? undefined : JSON.stringify(body) }, (data, order) => {
      if (method === 'DELETE') return data.deletedPlacementId === item?.id && sameMembers(order, ids.filter(id => id !== item?.id));
      const row = record(data.placement), project = record(row?.project);
      if (!row || !project || typeof row.id !== 'string' || typeof row.active !== 'boolean' || typeof row.displayOrder !== 'number' || !(row.titleOverride === null || typeof row.titleOverride === 'string')) return false;
      if (method === 'POST') return row.projectId === body.projectId && projects.some(p => p.id === row.projectId) && !ids.includes(row.id) && sameMembers(order, [...ids, row.id]);
      return row.id === item?.id && row.projectId === item.projectId && sameMembers(order, ids) && (!('active' in body) || row.active === body.active) && (row.titleOverride === normalized('titleOverride' in body ? body.titleOverride : item.titleOverride));
    });
    if (!recovery.current(token)) return;
    if (data) {
      if (method === 'POST') { const row = data.placement as Placement; setPlacements(current => [...current, { ...row, imageUrl: null }]); setSelected(current => current === snapshot.selected ? '' : current); }
      else if (method === 'DELETE') setPlacements(current => current.filter(row => row.id !== item!.id));
      else setPlacements(current => current.map(row => row.id === item!.id ? mergeDraft(row, item!, { ...item!, ...data.placement as Placement }) : row));
      recovery.complete(token, false);
    }
    setBusy(false);
  }
  const add = () => { if (selected) void change('POST', { projectId: selected }); };
  const update = (item: Placement, patch: { active?: boolean; titleOverride?: string }) => change('PATCH', { placementId: item.id, ...patch }, item);
  const remove = (item: Placement) => change('DELETE', {}, item);
  return <>{recovery.panel}<section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"><div className="flex flex-col gap-3 sm:flex-row"><select value={selected} onChange={(event) => { if (recovery.edit(snapshot)) setSelected(event.target.value); }} disabled={locked || placements.length >= 1} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white"><option value="">Select a published project</option>{available.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button type="button" onClick={add} disabled={!selected || locked || placements.length >= 1} className="admin-btn-primary">Set Featured Project</button></div><p className="mt-3 text-xs text-white/25">{placements.length ? "Featured Project configured" : "No Featured Project selected"}</p></section>{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200/75">{error}</p>}<section className="space-y-4">{placements.map((item) => <article key={item.id} className={`grid overflow-hidden rounded-2xl border bg-[#111] sm:grid-cols-[13rem_minmax(0,1fr)] ${item.active ? "border-white/[0.09]" : "border-white/[0.05] opacity-65"}`}><div className="relative min-h-44 bg-white/[0.03]">{item.imageUrl ? <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={item.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
  </> : <div className="flex h-full items-center justify-center text-xs text-white/20">Hero image required</div>}<span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[0.5rem] uppercase tracking-[0.13em] text-white/60">Featured Project</span></div><div className="p-5"><h2 className="text-lg text-white/80">{item.project.title}</h2><p className="mt-1 text-xs text-white/25">/{item.project.slug}</p><label className="mt-5 block text-[0.52rem] uppercase tracking-[0.14em] text-white/30">Homepage title<input value={item.titleOverride ?? ""} onChange={(event) => { if (recovery.edit(snapshot)) setPlacements(current => current.map(row => row.id === item.id ? { ...row, titleOverride: event.target.value } : row)); }} placeholder={item.project.title} onBlur={(event) => void update(item, { titleOverride: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white" /></label><div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4"><button disabled={locked} onClick={() => update(item, { active: !item.active })} className="ml-auto text-[0.52rem] uppercase tracking-[0.13em] text-white/35">{item.active ? "Hide" : "Show"}</button><button disabled={locked} onClick={() => remove(item)} className="admin-btn-link-destructive">Remove</button></div></div></article>)}{placements.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center"><p className="font-display text-4xl font-light text-white/30">No Featured Project selected.</p><p className="mt-3 text-sm text-white/20">The five service cards will lead the section.</p></div>}</section></>;
}
