import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function recordAuditEvent(event: { actorId?: string | null; actorEmail?: string | null; action: string; entityType?: string; entityId?: string; summary: string; metadata?: Prisma.InputJsonValue; ipAddress?: string | null; userAgent?: string | null }) {
  try { await prisma.auditEvent.create({ data: { ...event, metadata: event.metadata } }); }
  catch (error) { console.error("Unable to record audit event:", error); }
}
