import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from '@/lib/workspace-write-access';
import { featuredWindow, isActivelyFeatured, type FeaturedDuration } from '@/lib/featured-project';
import { tryResolveExternalMedia } from '@/lib/external-media';

export class ProjectPublishingError extends Error {
  constructor(message: string, public status: number, public blockers: string[] = []) { super(message); }
}

/** Serialize publication and placement with workspace administration and other project writers. */
export async function saveProjectPublishing(actor: WorkspaceWriteActor, projectId: string, action: 'publish' | 'set-featured', expectedUpdatedAt: unknown, expectedStatus: unknown, duration: FeaturedDuration = 'NONE') {
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId} AND "workspaceId"=${actor.workspaceId} FOR UPDATE`;
    const project = await tx.project.findFirst({ where: { id: projectId, workspaceId: actor.workspaceId }, select: { id: true, slug: true, status: true, updatedAt: true, featured: true, featuredExpiresAt: true, publishedAt: true, shortDescription: true, heroMediaId: true } });
    if (!project) throw new ProjectPublishingError('Project not found.', 404);
    if (typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt !== project.updatedAt.toISOString() || expectedStatus !== project.status) {
      throw new ProjectPublishingError('This project changed. Review its saved status before making another change.', 409);
    }
    const now = new Date();
    if (action === 'set-featured') {
      if (duration !== 'NONE' && project.status !== 'PUBLISHED') throw new ProjectPublishingError('Only published projects can be featured.', 409);
      // Renewing an expired feature consumes a slot just like a new placement.
      if (duration !== 'NONE' && !isActivelyFeatured(project, now)) {
        const count = await tx.project.count({ where: { workspaceId: actor.workspaceId, status: 'PUBLISHED', featured: true, OR: [{ featuredExpiresAt: null }, { featuredExpiresAt: { gt: now } }] } });
        if (count >= 6) throw new ProjectPublishingError('Six projects are already featured. Use Featured Projects management to replace one.', 409);
      }
    } else {
      // Read requirements after acquiring their rows, not from a pre-transaction snapshot.
      await tx.$queryRaw`SELECT id FROM "Media" WHERE "projectId"=${projectId} ORDER BY id FOR UPDATE`;
      const assignments = await tx.projectService.findMany({ where: { projectId }, select: { serviceId: true } });
      for (const { serviceId } of assignments.sort((a, b) => a.serviceId.localeCompare(b.serviceId))) {
        await tx.$queryRaw`SELECT id FROM "Service" WHERE id=${serviceId} AND "workspaceId"=${actor.workspaceId} FOR UPDATE`;
      }
      const media = await tx.media.findMany({ where: { projectId, visibility: 'VISIBLE' }, select: { id: true, sourceType: true, externalUrl: true } });
      const activeServices = await tx.service.count({ where: { workspaceId: actor.workspaceId, id: { in: assignments.map(row => row.serviceId) }, active: true, archivedAt: null } });
      const video = media.some(item => {
        if (!['VIDEO_EMBED', 'UPLOADED_VIDEO'].includes(item.sourceType)) return false;
        const resolved = tryResolveExternalMedia(item.externalUrl);
        return Boolean(resolved?.embedUrl || resolved?.playbackUrl);
      });
      const blockers = [];
      if (!project.shortDescription && !video) blockers.push('Add a short project description.');
      if (!media.some(item => item.id === project.heroMediaId) && !video) blockers.push('Select a visible hero image or add a playable video.');
      if (!media.length) blockers.push('Add at least one visible media asset.');
      if (!activeServices) blockers.push('Assign at least one active service.');
      if (blockers.length) throw new ProjectPublishingError('Complete the publishing requirements before going live.', 409, blockers);
    }
    return tx.project.update({
      where: { id: projectId, workspaceId: actor.workspaceId },
      data: {
        ...(action === 'publish' ? { status: 'PUBLISHED' as const, publishedAt: project.publishedAt ?? now, archivedAt: null, ...(project.status !== 'PUBLISHED' ? featuredWindow('NONE', now) : {}) } : featuredWindow(duration, now)),
        updatedAt: new Date(Math.max(now.getTime(), project.updatedAt.getTime() + 1)),
      },
      select: { id: true, slug: true, status: true, featured: true, featuredStartedAt: true, featuredExpiresAt: true, publishedAt: true, updatedAt: true },
    });
  });
}
