import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function recordAuditEvent(event: { workspaceId?: string | null; actorId?: string | null; actorEmail?: string | null; action: string; entityType?: string; entityId?: string; summary: string; metadata?: Prisma.InputJsonValue; ipAddress?: string | null; userAgent?: string | null }) {
  // Missing ownership stays unclassified. Never infer historical ownership from
  // an actor's current account, request headers or metadata.
  try { await prisma.auditEvent.create({ data: { ...event, workspaceId: event.workspaceId ?? null, metadata: event.metadata } }); }
  catch (error) { console.error("Unable to record audit event:", error); }
}
