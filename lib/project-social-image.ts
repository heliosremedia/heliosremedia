import { tryResolveExternalMedia } from "./external-media.ts";
import { getAbsoluteUrl } from "./site.ts";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const GLOBAL_FALLBACK_PATH = "/work/modern-retreat.jpg";

function getStablePublicAssetUrl(storageKey: string) {
  const publicBase = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (!publicBase) return getAbsoluteUrl(`/media/${storageKey.replace(/^\/+/, "")}`);
  return `${publicBase}/${storageKey.replace(/^\/+/, "")}`;
}

export type SocialImageSource = "SOCIAL" | "HERO" | "GALLERY" | "VIDEO_THUMBNAIL" | "WORKSPACE_DEFAULT" | "MONOGRAM" | "GLOBAL_FALLBACK";
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
  url: string; alt: string; width?: number; height?: number; type: string; source: SocialImageSource;
};

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

function landscapeScore(media: ProjectSocialMedia) {
  const ratio = media.aspectRatio || (media.width && media.height ? media.width / media.height : 0);
  const ratioDistance = ratio > 0 ? Math.abs(ratio - 1.91) : 10;
  const largeEnough = (media.width || 0) >= 1200 && (media.height || 0) >= 630;
  return (largeEnough ? 100 : 0) - ratioDistance * 10 - (media.displayOrder || 0) / 1000;
}

export function resolveProjectSocialImage(project: ProjectSocialImageInput): ResolvedProjectSocialImage {
  if (isUsableUploadedImage(project.socialImageMedia)) return fromUploadedMedia(project.socialImageMedia, project.title, "SOCIAL");
  if (isUsableUploadedImage(project.heroMedia)) return fromUploadedMedia(project.heroMedia, project.title, "HERO");
  const gallery = project.media.filter(isUsableUploadedImage)
    .sort((first, second) => landscapeScore(second) - landscapeScore(first))[0];
  if (gallery) return fromUploadedMedia(gallery, project.title, "GALLERY");
  for (const media of project.media) {
    if (media.visibility !== "VISIBLE" || !["VIDEO_EMBED", "UPLOADED_VIDEO"].includes(media.sourceType)) continue;
    const thumbnail = tryResolveExternalMedia(media.externalUrl)?.thumbnailUrl;
    if (thumbnail?.startsWith("https://")) return {
      url: thumbnail, alt: media.altText || `${project.title} video preview`,
      type: "image/jpeg", source: "VIDEO_THUMBNAIL",
    };
  }
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
