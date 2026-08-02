import { getAbsoluteUrl, getConfiguredAbsoluteUrl } from "./site.ts";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const GLOBAL_FALLBACK_PATH = "/work/modern-retreat.jpg";

function getStablePublicAssetUrl(storageKey: string) {
  const publicBase = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (!publicBase) return getAbsoluteUrl(`/media/${storageKey.replace(/^\/+/, "")}`);
  return `${publicBase}/${storageKey.replace(/^\/+/, "")}`;
}

export type SocialImageSource = "SOCIAL" | "HERO" | "WORKSPACE_DEFAULT" | "MONOGRAM" | "GLOBAL_FALLBACK";
export type ProjectSocialMedia = {
  id: string; sourceType: string; storageKey: string | null; mimeType: string | null;
  altText: string | null; originalFilename?: string | null; width: number | null;
  height: number | null; aspectRatio?: number | null; visibility: string;
  displayOrder?: number; externalUrl?: string | null;
};
export type ProjectSocialImageInput = {
  title: string;
  socialImageMedia?: ProjectSocialMedia | null;
  heroMedia?: ProjectSocialMedia | null;
  media: ProjectSocialMedia[];
  workspace?: {
    businessName: string;
    defaultSocialImageUrl?: string | null;
    defaultSocialImageAlt?: string | null;
    defaultSocialImageVersion?: number | null;
    brandMonogramUrl?: string | null;
  } | null;
};
export type ResolvedProjectSocialImage = {
  url: string; alt: string; width?: number; height?: number; type?: string; source: SocialImageSource;
};

export function optimizeProjectSocialImage(
  image: ResolvedProjectSocialImage,
  websiteUrl?: string | null,
): ResolvedProjectSocialImage {
  if (!["SOCIAL", "HERO", "GLOBAL_FALLBACK"].includes(image.source)) return image;
  const width = 1200;
  const height = image.width && image.height
    ? Math.round((image.height / image.width) * width)
    : undefined;
  const path = `/_next/image?url=${encodeURIComponent(image.url)}&w=${width}&q=75`;
  return {
    ...image,
    url: getConfiguredAbsoluteUrl(path, websiteUrl),
    width,
    ...(height ? { height } : {}),
    type: undefined,
  };
}

function isUsableUploadedImage(media: ProjectSocialMedia | null | undefined): media is ProjectSocialMedia {
  return Boolean(media && media.visibility === "VISIBLE" && media.sourceType === "UPLOADED_IMAGE" &&
    media.storageKey && media.mimeType && SUPPORTED_IMAGE_TYPES.has(media.mimeType));
}

function fromUploadedMedia(media: ProjectSocialMedia, title: string, source: SocialImageSource): ResolvedProjectSocialImage {
  return {
    url: getStablePublicAssetUrl(media.storageKey!), alt: media.altText || media.originalFilename || title,
    ...(media.width ? { width: media.width } : {}), ...(media.height ? { height: media.height } : {}),
    type: media.mimeType!, source,
  };
}

export function resolveProjectSocialImage(project: ProjectSocialImageInput): ResolvedProjectSocialImage {
  if (isUsableUploadedImage(project.socialImageMedia)) return fromUploadedMedia(project.socialImageMedia, project.title, "SOCIAL");
  if (isUsableUploadedImage(project.heroMedia)) return fromUploadedMedia(project.heroMedia, project.title, "HERO");
  if (project.workspace?.defaultSocialImageUrl) {
    const separator = project.workspace.defaultSocialImageUrl.includes("?") ? "&" : "?";
    const version = project.workspace.defaultSocialImageVersion || 0;
    return {
      url: `${project.workspace.defaultSocialImageUrl}${separator}v=${version}`,
      alt: project.workspace.defaultSocialImageAlt || `${project.workspace.businessName} social share image`,
      width: 1200, height: 630, type: "image/jpeg", source: "WORKSPACE_DEFAULT",
    };
  }
  if (project.workspace?.brandMonogramUrl) {
    return {
      url: project.workspace.brandMonogramUrl,
      alt: `${project.workspace.businessName} brand mark`,
      type: "image/png", source: "MONOGRAM",
    };
  }
  return {
    url: getAbsoluteUrl(GLOBAL_FALLBACK_PATH), alt: "Helios Real Estate Media",
    width: 7008, height: 4672, type: "image/jpeg", source: "GLOBAL_FALLBACK",
  };
}
