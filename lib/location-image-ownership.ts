import { resolveBrandImage } from "./workspace-brand-storage";

type ImageReference = { key: string | null; url: string | null };

export function resolveLocationImage(workspaceId: string, locationId: string | null, submitted: ImageReference,
  existing: ImageReference | null, publicUrl: (key: string) => string): ImageReference {
  if (!submitted.key && !submitted.url) return { key: null, url: null };
  const legacy = submitted.key?.match(/^site\/locations\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (legacy) {
    // Explicit legacy company and record identity must match even when a
    // corrupt row already contains the foreign key. Never attach new legacy keys.
    if (legacy[1] !== workspaceId || legacy[2] !== locationId || !/^[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/.test(legacy[3])
      || submitted.key !== existing?.key) throw new Error("INVALID_BRAND_IMAGE");
    return { key: submitted.key, url: publicUrl(submitted.key!) };
  }
  if (submitted.key?.startsWith("site/locations/")) {
    const oldRecordKey = submitted.key.match(/^site\/locations\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+\.(?:jpg|png|webp|avif))$/);
    if (!oldRecordKey || oldRecordKey[1] !== locationId || submitted.key !== existing?.key) throw new Error("INVALID_BRAND_IMAGE");
    return { key: submitted.key, url: publicUrl(submitted.key) };
  }
  if (submitted.key && /(?:^|\/)\.\.(?:\/|$)|[?%#\\]/.test(submitted.key)) throw new Error("INVALID_BRAND_IMAGE");
  // URL-only references must not hide another company's scoped object.
  if (!submitted.key && /\/(?:workspaces|site\/locations)\//.test(submitted.url || "")) throw new Error("INVALID_BRAND_IMAGE");
  return resolveBrandImage(workspaceId, "locations", submitted, existing, publicUrl);
}

/** Withhold corrupt image pointers from read DTOs without rewriting stored rows. */
export function readableLocationImage(workspaceId: string, locationId: string, image: ImageReference, publicUrl: (key: string) => string): ImageReference {
  try { return resolveLocationImage(workspaceId, locationId, image, image, publicUrl); }
  catch { return { key: null, url: null }; }
}
