import { brandAssetPrefix } from "./workspace-brand-storage";

type FilmAsset = { key: string | null; url: string | null };

export function resolveFeaturedFilmAsset(workspaceId: string, kind: "video" | "poster", submitted: FilmAsset,
  existing: FilmAsset | null, publicUrl: (key: string) => string): FilmAsset {
  const prefix = brandAssetPrefix(workspaceId, "site-featured-film");
  if (submitted.key?.startsWith(prefix)) {
    const filename = submitted.key.slice(prefix.length);
    const pattern = kind === "video" ? /^video-[a-zA-Z0-9_-]+\.(mp4|webm)$/ : /^poster-[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/;
    if (!pattern.test(filename)) throw new Error("INVALID_BRAND_IMAGE");
    return { key: submitted.key, url: publicUrl(submitted.key) };
  }
  if (!submitted.key && !submitted.url) return { key: null, url: null };
  // No new legacy attachment, even when an object happens to exist. Preserve
  // only the exact pair already on this authorized settings record.
  if (existing && submitted.key === existing.key && submitted.url === existing.url
    && !submitted.key?.startsWith("workspaces/") && !submitted.url?.includes("/workspaces/")) return existing;
  throw new Error("INVALID_BRAND_IMAGE");
}
