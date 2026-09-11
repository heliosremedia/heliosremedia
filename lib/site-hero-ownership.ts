import { brandAssetPrefix } from "./workspace-brand-storage";

export function resolveSiteHeroUrl(workspaceId: string, kind: "video" | "poster", submitted: string | null,
  existing: string | null, publicUrl: (key: string) => string) {
  if (!submitted) return { url: null, key: null };
  const prefix = brandAssetPrefix(workspaceId, "site-hero");
  const publicPrefix = publicUrl(prefix);
  if (submitted.startsWith(publicPrefix)) {
    const filename = submitted.slice(publicPrefix.length);
    const pattern = kind === "video" ? /^video-[a-zA-Z0-9_-]+\.(mp4|webm)$/ : /^poster-[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/;
    if (!pattern.test(filename)) throw new Error("INVALID_HERO_MEDIA");
    return { url: publicUrl(prefix + filename), key: prefix + filename };
  }
  if (submitted === existing && !submitted.includes("/workspaces/")) return { url: existing, key: null };
  throw new Error("INVALID_HERO_MEDIA");
}
