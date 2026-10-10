import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getContentOwnershipScope } from '@/lib/blog-ownership';
import { isActivelyFeatured } from '@/lib/featured-project';

/** One reviewed snapshot includes candidates, placement windows and saved ordering. */
export async function readFeaturedProjectReview(tx: Prisma.TransactionClient, workspaceId: string, now = new Date()) {
  const projects = await tx.project.findMany({
    where: { workspaceId, OR: [{ status: 'PUBLISHED' }, { featured: true }] },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, slug: true, status: true, featured: true, featuredStartedAt: true, featuredExpiresAt: true, updatedAt: true, displayOrder: true },
  });
  const event = await tx.auditEvent.findFirst({ where: { ...await getContentOwnershipScope(workspaceId, tx), action: 'FEATURED_PROJECTS_FINALIZED', entityType: 'Project', entityId: workspaceId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, metadata: true } });
  const metadata = event?.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata : {};
  const order = Array.isArray(metadata.projectIds) ? metadata.projectIds.filter((id): id is string => typeof id === 'string').slice(0, 6) : [];
  // Expiry changing the displayed set invalidates a review, without a ticking timestamp token.
  const activeIds = projects.filter(project => project.status === 'PUBLISHED' && isActivelyFeatured(project, now)).map(project => project.id);
  const revision = createHash('sha256').update(JSON.stringify({ workspaceId, projects, event, activeIds })).digest('hex');
  return { revision, projects: projects.filter(project => project.status === 'PUBLISHED'), order, activeIds };
}

export function getFeaturedProjectReview(workspaceId: string) {
  return prisma.$transaction(tx => readFeaturedProjectReview(tx, workspaceId), { isolationLevel: 'RepeatableRead' });
}
