import "server-only";
import { prisma } from "@/lib/prisma";
import { getAbsoluteUrl } from "@/lib/site";
import { normalizeWorkspaceHostname, tenantContextEnabled } from "@/lib/workspace-context-core";

export async function getWorkspacePreviewUrl(workspaceId: string, path: string) {
  if (!workspaceId || !path.startsWith("/portfolio/")) throw new Error("PREVIEW_DOMAIN_REQUIRED");
  if (!tenantContextEnabled()) {
    const rows = await prisma.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length === 1 && rows[0].id === workspaceId) return getAbsoluteUrl(path);
  }
  const domains = await prisma.workspaceDomain.findMany({
    where: { workspaceId, purpose: "PUBLIC_SITE", status: "ACTIVE" },
    orderBy: [{ primary: "desc" }, { hostname: "asc" }], take: 2,
    select: { hostname: true, primary: true },
  });
  const domain = domains[0];
  if (!domain || (domains.length > 1 && (!domain.primary || domains[1].primary))) throw new Error("PREVIEW_DOMAIN_REQUIRED");
  const hostname = normalizeWorkspaceHostname(domain.hostname);
  if (!hostname || hostname !== domain.hostname) throw new Error("PREVIEW_DOMAIN_REQUIRED");
  return new URL(path, `https://${hostname}`).toString();
}
