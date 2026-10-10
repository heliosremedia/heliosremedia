import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from '@/lib/workspace-write-access';

export class ProjectServiceSelectionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** A reviewed replacement of the service selection, using the existing project revision. */
export async function saveProjectServices(actor: WorkspaceWriteActor, projectId: string, expectedUpdatedAt: unknown, expectedServiceIds: unknown, selection: unknown) {
  if (!Array.isArray(selection) || selection.length > 200 || !selection.every(id => typeof id === 'string' && id.trim().length > 0 && id.length <= 200)) {
    throw new ProjectServiceSelectionError('A valid service selection is required.', 400);
  }
  const serviceIds: string[] = selection.map(id => id.trim());
  if (new Set(serviceIds).size !== serviceIds.length) throw new ProjectServiceSelectionError('The selected service list contains duplicates.', 400);
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId} AND "workspaceId"=${actor.workspaceId} FOR UPDATE`;
    const project = await tx.project.findFirst({ where: { id: projectId, workspaceId: actor.workspaceId }, select: { id: true, slug: true, updatedAt: true } });
    if (!project) throw new ProjectServiceSelectionError('Project not found.', 404);
    if (typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt !== project.updatedAt.toISOString()) {
      throw new ProjectServiceSelectionError('This project changed. Review the saved project before replacing its services.', 409);
    }
    // Sorted parent locks retain current ownership, availability and inactive-service rules through commit.
    for (const id of [...serviceIds].sort()) await tx.$queryRaw`SELECT id FROM "Service" WHERE id=${id} AND "workspaceId"=${actor.workspaceId} FOR UPDATE`;
    const services = await tx.service.findMany({ where: { workspaceId: actor.workspaceId, archivedAt: null, id: { in: serviceIds } }, select: { id: true, active: true } });
    const existing = await tx.projectService.findMany({ where: { projectId }, select: { serviceId: true } });
    const existingIds = new Set(existing.map(row => row.serviceId));
    // Media operations can add an assignment without changing the project row.
    // Compare the reviewed selection too so those additions cannot be silently removed.
    if (!Array.isArray(expectedServiceIds) || expectedServiceIds.length !== existingIds.size || new Set(expectedServiceIds).size !== existingIds.size || !expectedServiceIds.every(id => typeof id === 'string' && existingIds.has(id))) {
      throw new ProjectServiceSelectionError('The saved service selection changed. Review the saved project before replacing its services.', 409);
    }
    if (services.length !== serviceIds.length || services.some(service => !service.active && !existingIds.has(service.id))) {
      throw new ProjectServiceSelectionError('One or more selected services are no longer available. Review the saved project.', 409);
    }
    await tx.projectService.deleteMany({ where: { projectId } });
    if (serviceIds.length) await tx.projectService.createMany({ data: serviceIds.map(serviceId => ({ projectId, serviceId })) });
    const saved = await tx.project.update({ where: { id: projectId, workspaceId: actor.workspaceId }, data: { updatedAt: new Date(Math.max(Date.now(), project.updatedAt.getTime() + 1)) }, select: { id: true, slug: true, updatedAt: true } });
    return { project: saved, serviceIds };
  });
}
