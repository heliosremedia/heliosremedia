import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireLockedWorkspaceEditor, type WorkspaceWriteActor } from '@/lib/workspace-write-access';

export type ProjectDraftInput = { title: string; slug: string; shortDescription: string; city: string; state: string; locationLabel: string; projectType: string; propertyType: string };
const limits: Record<keyof ProjectDraftInput, number> = { title: 120, slug: 140, shortDescription: 320, city: 120, state: 120, locationLabel: 180, projectType: 120, propertyType: 120 };
const slugify = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function createProjectDraft(actor: WorkspaceWriteActor, requestId: string, input: ProjectDraftInput) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error('PROJECT_DRAFT_REQUEST_INVALID');
  for (const field of Object.keys(limits) as Array<keyof ProjectDraftInput>) if (typeof input[field] !== 'string' || input[field].length > limits[field]) throw new Error('PROJECT_DRAFT_INPUT_INVALID');
  if (!input.title.trim()) throw new Error('PROJECT_DRAFT_TITLE_REQUIRED');
  // The existing primary key records a submission identity without a second state store.
  // Include both current workspace and actor; never accept a caller-supplied project ID.
  const id = `draft_${createHash('sha256').update(JSON.stringify(['studio-draft-v1', actor.workspaceId, actor.userId, requestId])).digest('hex')}`;
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceEditor(tx, actor);
    const existing = await tx.project.findFirst({ where: { id, workspaceId: actor.workspaceId }, select: { id: true } });
    if (existing) return { id: existing.id, reused: true };
    const baseSlug = slugify(input.slug || input.title) || 'project';
    let slug = baseSlug, suffix = 2;
    while (await tx.project.findUnique({ where: { slug }, select: { id: true } })) slug = `${baseSlug.slice(0, 130)}-${suffix++}`;
    const project = await tx.project.create({ data: { id, workspaceId: actor.workspaceId, title: input.title.trim(), slug,
      shortDescription: input.shortDescription.trim() || null, city: input.city.trim() || null, state: input.state.trim() || null,
      locationLabel: input.locationLabel.trim() || null, projectType: input.projectType.trim() || null, propertyType: input.propertyType.trim() || null, status: 'DRAFT',
    }, select: { id: true } });
    return { id: project.id, reused: false };
  });
}
