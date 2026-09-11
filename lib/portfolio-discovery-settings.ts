import { getContentOwnershipScope } from "@/lib/blog-ownership";
import "server-only";

import { prisma } from "@/lib/prisma";
import type { PortfolioOrderingMode } from "@/lib/portfolio-discovery-core";

export type PortfolioDiscoverySettings = {
  photoEnabled: boolean;
  filmEnabled: boolean;
  photoButtonLabel: string;
  filmButtonLabel: string;
  photoOrderingMode: PortfolioOrderingMode;
  filmOrderingMode: PortfolioOrderingMode;
  initialItemCount: number;
  excludedProjectIds: string[];
  excludedMediaIds: string[];
};

export const defaultPortfolioDiscoverySettings: PortfolioDiscoverySettings = {
  photoEnabled: true,
  filmEnabled: true,
  photoButtonLabel: "Browse All Photography",
  filmButtonLabel: "Watch All Films",
  photoOrderingMode: "ROTATING_MIX",
  filmOrderingMode: "ROTATING_MIX",
  initialItemCount: 24,
  excludedProjectIds: [],
  excludedMediaIds: [],
};

function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 1000) : []; }
function ordering(value: unknown): PortfolioOrderingMode { return value === "CURATED" || value === "NEWEST" ? value : "ROTATING_MIX"; }

export async function getPortfolioDiscoverySettings(workspaceId: string): Promise<PortfolioDiscoverySettings> {
  const event = await prisma.auditEvent.findFirst({ where: { ...await getContentOwnershipScope(workspaceId), action: "PORTFOLIO_DISCOVERY_SETTINGS_UPDATED", entityType: "PortfolioDiscoverySettings", entityId: workspaceId }, orderBy: { createdAt: "desc" }, select: { metadata: true } });
  if (!event?.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) return defaultPortfolioDiscoverySettings;
  const value = event.metadata as Record<string, unknown>;
  return {
    photoEnabled: value.photoEnabled !== false,
    filmEnabled: value.filmEnabled !== false,
    photoButtonLabel: typeof value.photoButtonLabel === "string" && value.photoButtonLabel.trim() ? value.photoButtonLabel.slice(0, 80) : defaultPortfolioDiscoverySettings.photoButtonLabel,
    filmButtonLabel: typeof value.filmButtonLabel === "string" && value.filmButtonLabel.trim() ? value.filmButtonLabel.slice(0, 80) : defaultPortfolioDiscoverySettings.filmButtonLabel,
    photoOrderingMode: ordering(value.photoOrderingMode),
    filmOrderingMode: ordering(value.filmOrderingMode),
    initialItemCount: Math.min(48, Math.max(6, Number(value.initialItemCount) || 24)),
    excludedProjectIds: strings(value.excludedProjectIds),
    excludedMediaIds: strings(value.excludedMediaIds),
  };
}

export async function getFeaturedProjectOrder(workspaceId: string) {
  const event = await prisma.auditEvent.findFirst({ where: { ...await getContentOwnershipScope(workspaceId), action: "FEATURED_PROJECTS_FINALIZED", entityType: "Project", entityId: workspaceId }, orderBy: { createdAt: "desc" }, select: { metadata: true } });
  if (!event?.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) return [];
  return strings((event.metadata as Record<string, unknown>).projectIds).slice(0, 6);
}
