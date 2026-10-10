import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export async function readProjectOrderReview(tx: Prisma.TransactionClient, workspaceId: string) {
  const projects = await tx.project.findMany({ where: { workspaceId },
    orderBy: [{ displayOrder: 'asc' }, { updatedAt: 'desc' }, { title: 'asc' }, { id: 'asc' }],
    select: { id: true, displayOrder: true, updatedAt: true },
  });
  const revision = createHash('sha256').update(JSON.stringify({ workspaceId, projects })).digest('hex');
  return { revision, projects };
}

export function getProjectOrderReview(workspaceId: string) {
  return readProjectOrderReview(prisma, workspaceId);
}
