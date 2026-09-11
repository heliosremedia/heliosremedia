import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { normalizeWorkspaceHostname, tenantContextEnabled, isLocalWorkspaceHostname } from "@/lib/workspace-context-core";

async function getLegacyPublicWorkspaceId() {
  const settings = await prisma.siteSettings.findFirst({
    where: { workspaceId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { workspaceId: true },
  });
  if (settings?.workspaceId) return settings.workspaceId;

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!workspace) throw new Error("A public workspace is not configured.");
  return workspace.id;
}

export async function getPublicWorkspaceId() {
  if (!tenantContextEnabled()) return getLegacyPublicWorkspaceId();

  const hostname = normalizeWorkspaceHostname((await headers()).get("host"));
  if (!hostname) throw new Error("The public workspace host is missing or invalid.");

  const domain = await prisma.workspaceDomain.findUnique({
    where: { hostname },
    select: { workspaceId: true, purpose: true, status: true },
  });
  if (domain?.purpose === "PUBLIC_SITE" && domain.status === "ACTIVE") return domain.workspaceId;

  if (process.env.NODE_ENV !== "production" && isLocalWorkspaceHostname(hostname)) {
    const localWorkspaceSlug = process.env.STUDIO_V2_LOCAL_WORKSPACE_SLUG?.trim();
    if (localWorkspaceSlug) {
      const workspace = await prisma.workspace.findUnique({ where: { slug: localWorkspaceSlug }, select: { id: true } });
      if (workspace) return workspace.id;
    }
  }

  throw new Error("No active public workspace is configured for this host.");
}
