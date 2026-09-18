import type { Prisma } from '@/app/generated/prisma/client';
/** Lock only the curation graph and submitted candidate parents, never whole tenant tables. */
export async function lockCurationParents(tx: Prisma.TransactionClient, workspaceId: string, scope: 'projects' | 'work-cards', request: Request) {
 const input = request.method === 'DELETE' ? null : await request.clone().json().catch(() => null);
 const body = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
 const candidate = typeof body[scope === 'projects' ? 'projectId' : 'serviceId'] === 'string' ? body[scope === 'projects' ? 'projectId' : 'serviceId'] as string : '';
 if (scope === 'projects') {
  await tx.$queryRaw`SELECT p.id FROM "Project" p WHERE p."workspaceId" = ${workspaceId} AND (p.id = ${candidate} OR p.id IN (SELECT "projectId" FROM "HomepageProject")) ORDER BY p.id FOR UPDATE OF p`;
  await tx.$queryRaw`SELECT h.id FROM "HomepageProject" h JOIN "Project" p ON p.id = h."projectId" WHERE p."workspaceId" = ${workspaceId} ORDER BY h.id FOR UPDATE OF h, p`;
 } else {
  await tx.$queryRaw`SELECT s.id FROM "Service" s WHERE s."workspaceId" = ${workspaceId} AND (s.id = ${candidate} OR s.id IN (SELECT "serviceId" FROM "HomepageWorkCard")) ORDER BY s.id FOR UPDATE OF s`;
  await tx.$queryRaw`SELECT h.id FROM "HomepageWorkCard" h JOIN "Service" s ON s.id = h."serviceId" WHERE s."workspaceId" = ${workspaceId} ORDER BY h.id FOR UPDATE OF h, s`;
  const mediaId = typeof body.featuredMediaId === 'string' ? body.featuredMediaId : '';
  await tx.$queryRaw`SELECT m.id FROM "Media" m JOIN "Project" p ON p.id = m."projectId" WHERE p."workspaceId" = ${workspaceId} AND (m.id = ${mediaId} OR m.id IN (SELECT h."featuredMediaId" FROM "HomepageWorkCard" h JOIN "Service" s ON s.id = h."serviceId" WHERE s."workspaceId" = ${workspaceId})) ORDER BY p.id, m.id FOR UPDATE OF p, m`;
 }
}
