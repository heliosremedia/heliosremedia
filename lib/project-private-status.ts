import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from '@/lib/workspace-write-access';

export class ProjectPrivateStatusError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Remove a reviewed project from public display without deleting its content. */
export async function saveProjectPrivateStatus(actor: WorkspaceWriteActor, projectId: string, action: 'unpublish' | 'archive', expectedUpdatedAt: unknown, expectedStatus: unknown) {
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId} AND "workspaceId"=${actor.workspaceId} FOR UPDATE`;
    const project = await tx.project.findFirst({ where: { id: projectId, workspaceId: actor.workspaceId }, select: { id: true, slug: true, status: true, updatedAt: true } });
    if (!project) throw new ProjectPrivateStatusError('Project not found.', 404);
    if (typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt !== project.updatedAt.toISOString() || expectedStatus !== project.status) {
      throw new ProjectPrivateStatusError('This project changed. Review its saved status before making another change.', 409);
    }
    return tx.project.update({
      where: { id: projectId, workspaceId: actor.workspaceId },
      data: {
        status: action === 'archive' ? 'ARCHIVED' : 'DRAFT',
        publishedAt: null,
        archivedAt: action === 'archive' ? new Date() : null,
        featured: false,
        updatedAt: new Date(Math.max(Date.now(), project.updatedAt.getTime() + 1)),
      },
      select: { id: true, slug: true, status: true, featured: true, featuredStartedAt: true, featuredExpiresAt: true, publishedAt: true, updatedAt: true },
    });
  });
}
