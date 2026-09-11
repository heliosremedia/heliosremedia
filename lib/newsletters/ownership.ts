import "server-only";
import { prisma } from "@/lib/prisma";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

export async function resolveNewsletterWorkspace(storedWorkspaceId: string | null) {
  if (storedWorkspaceId) return storedWorkspaceId;
  if (!tenantContextEnabled()) {
    const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length === 1) return rows[0].id;
  }
  throw new Error("Newsletter ownership must be configured before generation.");
}

export async function requireNewsletterApprovalWorkspace(snapshot: unknown, seriesWorkspaceId: string | null) {
  const workspaceId = await resolveNewsletterWorkspace(seriesWorkspaceId);
  const value = snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>).workspaceId : undefined;
  if (value !== undefined) {
    if (value !== workspaceId) throw new Error("Newsletter approval belongs to another workspace.");
  } else {
    // Old approvals are compatible only in an unambiguous legacy installation.
    if (await resolveNewsletterWorkspace(null) !== workspaceId) throw new Error("Newsletter approval ownership must be renewed.");
  }
  return workspaceId;
}
