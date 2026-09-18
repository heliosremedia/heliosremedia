import { lockCurationParents } from '@/lib/homepage-curation-parent-lock';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requireLockedWorkspaceEditor, type WorkspaceWriteActor } from '@/lib/workspace-write-access';

export type CurationScope = 'projects' | 'work-cards';
type RevisionRow = { id: string; updatedAt: Date; displayOrder: number; projectId?: string; serviceId?: string };
/** Opaque content revision; ordering ties do not depend on database result order. */
export function curationRevision(workspaceId: string, scope: CurationScope, rows: RevisionRow[]) {
 return createHash('sha256').update(JSON.stringify([workspaceId, scope, [...rows].sort((a,b) => a.id.localeCompare(b.id)).map(row => [row.id, row.projectId ?? row.serviceId, row.displayOrder, row.updatedAt.toISOString()])])).digest('hex');
}
export async function curationSnapshot(tx: Prisma.TransactionClient, workspaceId: string, scope: CurationScope) {
 const orderBy = [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }];
 const rows = scope === 'projects'
  ? await tx.homepageProject.findMany({ where: { project: { workspaceId } }, orderBy, select: { id: true, projectId: true, displayOrder: true, updatedAt: true } })
  : await tx.homepageWorkCard.findMany({ where: { service: { workspaceId }, OR: [{ featuredMediaId: null }, { featuredMedia: { project: { workspaceId } } }] }, orderBy, select: { id: true, serviceId: true, displayOrder: true, updatedAt: true } });
 return { revision: curationRevision(workspaceId, scope, rows), ids: rows.map(row => row.id), timestamp: new Date(Math.max(Date.now(), ...rows.map(row => row.updatedAt.getTime() + 1))) };
}
class RejectedWrite extends Error { constructor(readonly response: Response) { super('CURATION_REJECTED'); } }
/** All writers, including legacy requests, share the lock and count/readback transaction. */
export async function withCurationWrite(actor: WorkspaceWriteActor, scope: CurationScope, request: Request, write: (tx: Prisma.TransactionClient, timestamp: Date) => Promise<Response>) {
 const revision = request.headers.get('x-curation-revision');
 const requestId = request.headers.get('x-curation-request');
 if ((revision !== null || requestId !== null) && (!revision || !requestId || revision.length > 128 || requestId.length > 100)) return NextResponse.json({ success: false, error: 'Invalid curation revision.' }, { status: 400 });
 try {
  const result = await prisma.$transaction(async tx => {
   await requireLockedWorkspaceEditor(tx, actor);
   await lockCurationParents(tx, actor.workspaceId, scope, request);
   const before = await curationSnapshot(tx, actor.workspaceId, scope);
   if (revision !== null && revision !== before.revision) throw new RejectedWrite(NextResponse.json({ success: false, error: 'Homepage curation changed. Retain your draft and reload to reconcile.' }, { status: 409 }));
   const response = await write(tx, before.timestamp);
   if (!response.ok) throw new RejectedWrite(response);
   const data = await response.json();
   const after = await curationSnapshot(tx, actor.workspaceId, scope);
   return NextResponse.json({ ...data, acknowledgement: { protocol: 1, requestId, workspaceId: actor.workspaceId, scope, previousRevision: before.revision, revision: after.revision, ids: after.ids } }, { status: response.status });
  }, { timeout: 15000 });
  revalidatePath('/'); revalidatePath('/admin/homepage');
  return result;
 } catch (error) {
  if (error instanceof RejectedWrite) return error.response;
  if (error instanceof Error && error.message === 'WORKSPACE_WRITE_FORBIDDEN') return NextResponse.json({ success: false, error: 'Editor access is required.' }, { status: 403 });
  throw error;
 }
}
