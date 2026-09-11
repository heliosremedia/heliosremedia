/** Pure policy shared by the server upload and mutation paths. */
export type BrandAssetKind = "testimonials" | "trusted-logos" | "blog" | "newsletter-ai" | "site-brand" | "site-homepage" | "site-hero" | "about" | "team" | "photo-comparison";

export function brandAssetPrefix(workspaceId: string, kind: BrandAssetKind) {
  // Reject invalid IDs rather than normalizing two identities into one namespace.
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) throw new Error("INVALID_BRAND_IMAGE");
  return `workspaces/${workspaceId}/${kind}/`;
}

export function resolveBrandImage(
  workspaceId: string,
  kind: BrandAssetKind,
  submitted: { key: string | null; url: string | null },
  existing: { key: string | null; url: string | null } | null,
  publicUrl: (key: string) => string,
) {
  const prefix = brandAssetPrefix(workspaceId, kind);
  if (submitted.key?.startsWith(prefix)) {
    const filename = submitted.key.slice(prefix.length);
    if (!/^[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/.test(filename)) throw new Error("INVALID_BRAND_IMAGE");
    return { key: submitted.key, url: publicUrl(submitted.key) };
  }
  // Preserve a legacy image only on the already-authorized record, unchanged.
  // Foreign workspace namespaces are never grandfathered in.
  if (existing && submitted.key === existing.key && submitted.url === existing.url
    && !submitted.key?.startsWith("workspaces/")) return existing;
  if (!submitted.key && !submitted.url) return { key: null, url: null };
  throw new Error("INVALID_BRAND_IMAGE");
}

/** Retain objects until a usage registry can prove deletion is safe. */
export function brandImageCleanupPending(key: string | null) {
  return Boolean(key);
}
