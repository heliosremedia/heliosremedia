import "server-only";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsWriteTarget } from "@/lib/site-settings-ownership";
import { defaultSiteSettings, type PublicSiteSettings } from "@/lib/site-settings";
import { normalizeGoogleReviewDisplayMode } from "@/lib/google-business-public";
import type { SettingsRevision } from "@/lib/site-settings-editor";

// Read values and their revision together. A separate revision read could bless stale values.
// Call only with the workspace of requireAdminSession(); failures must not become editable defaults.
export async function getAdminSiteSettings(workspaceId: string): Promise<{ settings: PublicSiteSettings; revision: SettingsRevision }> {
  const target = await getSiteSettingsWriteTarget(workspaceId);
  const row = await prisma.siteSettings.findUnique({ where: target.where });
  const settings = Object.fromEntries(Object.keys(defaultSiteSettings).map(key => [key,
    row ? row[key as keyof typeof row] : defaultSiteSettings[key as keyof PublicSiteSettings],
  ])) as PublicSiteSettings;
  settings.id = row?.id ?? target.createIdentity.id;
  settings.googleReviewDisplayMode = normalizeGoogleReviewDisplayMode(settings.googleReviewDisplayMode);
  for (const key of ["standardPrinciples", "approachCards", "headerNavigation", "footerNavigation"] as const) {
    if (!Array.isArray(settings[key])) Object.assign(settings, { [key]: defaultSiteSettings[key] });
  }
  return { settings, revision: {
    id: settings.id, workspaceId, storedWorkspaceId: row ? row.workspaceId : target.createIdentity.workspaceId,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  } };
}
