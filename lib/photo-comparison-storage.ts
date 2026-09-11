import { resolveBrandImage } from "@/lib/workspace-brand-storage";

export function resolvePhotoComparisonImage(
  workspaceId: string,
  submitted: { key: string | null; url: string | null },
  existing: { key: string | null; url: string | null } | null,
  publicUrl: (key: string) => string,
) {
  const legacyCompany = submitted.key?.match(/^site\/photo-comparison\/([^/]+)\//)?.[1];
  if (legacyCompany && legacyCompany !== workspaceId) throw new Error("INVALID_BRAND_IMAGE");
  const image = resolveBrandImage(workspaceId, "photo-comparison", submitted, existing, publicUrl);
  if (!image.url) throw new Error("INVALID_BRAND_IMAGE");
  return { key: image.key, url: image.url };
}

/** Exclude identifiable foreign namespaces in historical public references. */
export function photoComparisonImageMatchesWorkspace(workspaceId: string, image: { key: string | null; url: string | null }) {
  for (const value of [image.key, image.url]) {
    if (!value) continue;
    let path: string;
    try { path = decodeURIComponent(new URL(value, "https://assets.invalid/").pathname); } catch { return false; }
    const company = path.match(/(?:^|\/)workspaces\/([^/]+)\//)?.[1]
      ?? path.match(/(?:^|\/)site\/photo-comparison\/([^/]+)\//)?.[1];
    if (company && company !== workspaceId) return false;
  }
  return true;
}
