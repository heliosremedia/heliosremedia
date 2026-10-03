import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PrismaClient } from '../../../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createSessionToken, SESSION_COOKIE } from '../../../lib/auth/token';
import { requireDatabase } from './safety.mjs';

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabase(process.env.PACKET19_DATABASE_URL) }) });
export async function requireEmpty() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  assert.equal(rows.length, 0, 'Refuse populated databases; never reset or repair');
  const identity = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  assert.equal(identity[0].name, 'helios_packet19');
}
export async function seed() {
  assert.equal(await prisma.workspace.count(), 0);
  await prisma.$transaction(async tx => {
    for (const id of ['a', 'b']) {
      await tx.workspace.create({ data: { id, slug: `packet19-${id}`, name: `Synthetic ${id}` } });
      await tx.adminUser.create({ data: { id: `u${id}`, workspaceId: id, email: `${id}@example.test`, displayName: `Synthetic ${id}`, role: 'OWNER', disciplines: [], sessionVersion: 1 } });
      await tx.workspaceMembership.create({ data: { workspaceId: id, userId: `u${id}`, role: 'OWNER', status: 'ACTIVE' } });
      await tx.workspaceDomain.create({ data: { workspaceId: id, hostname: `${id}.example.test`, purpose: 'PUBLIC_SITE', status: 'ACTIVE' } });
      await tx.siteSettings.create({ data: { id: `settings-${id}`, workspaceId: id, businessName: `PACKET19 COMPANY ${id}`, bookingMode: 'UNAVAILABLE', bookingRequestEnabled: false, bookingHandoffEnabled: false } });
      await tx.project.create({ data: { id: `p${id}`, workspaceId: id, slug: `packet19-project-${id}`, title: 'Shared project title', status: 'PUBLISHED' } });
      await tx.service.create({ data: { id: `s${id}`, workspaceId: id, name: `Service ${id}`, slug: 'shared-service' } });
      await tx.media.create({ data: { id: `m${id}`, projectId: `p${id}`, serviceId: `s${id}`, sourceType: 'UPLOADED_IMAGE', mediaCategory: 'PHOTOGRAPHY', storageKey: `workspaces/${id}/synthetic.jpg` } });
      await tx.project.update({ where: { id: `p${id}` }, data: { heroMediaId: `m${id}` } });
      await tx.homepageProject.create({ data: { id: `hp${id}`, projectId: `p${id}`, titleOverride: `PACKET19 INITIAL ${id}` } });
    }
  });
}
export function cookie(id: string) {
  assert.ok(['a', 'b'].includes(id));
  return `${SESSION_COOKIE}=${createSessionToken({ userId: `u${id}`, email: `${id}@example.test`, displayName: `Synthetic ${id}`, role: 'OWNER', sessionVersion: 1 })}`;
}
export async function snapshot(id: string) {
  const rows = await prisma.homepageProject.findMany({ where: { project: { workspaceId: id } }, orderBy: { id: 'asc' } });
  const revision = createHash('sha256').update(JSON.stringify([id, 'projects', rows.map(r => [r.id, r.projectId, r.displayOrder, r.updatedAt.toISOString()])])).digest('hex');
  return { rows, revision };
}
export async function schemaFingerprint() {
  const columns = await prisma.$queryRaw`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`;
  return createHash('sha256').update(JSON.stringify(columns)).digest('hex');
}
