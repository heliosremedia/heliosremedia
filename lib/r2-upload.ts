import { brandAssetPrefix } from "@/lib/workspace-brand-storage";
import { randomUUID } from "crypto";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { r2Client, r2Config } from "@/lib/r2";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const MEDIA_CATEGORIES = [
  "PHOTOGRAPHY",
  "DRONE_PHOTOGRAPHY",
  "CINEMATIC_FILM",
  "VERTICAL_REEL",
  "AGENT_BRANDING",
  "SOCIAL_CONTENT",
  "FLOOR_PLAN",
  "PROPERTY_WEBSITE",
  "MATTERPORT",
  "OTHER",
] as const;

export type UploadMediaCategory =
  (typeof MEDIA_CATEGORIES)[number];

const MEDIA_CATEGORY_FOLDERS: Record<
  UploadMediaCategory,
  string
> = {
  PHOTOGRAPHY: "photography",
  DRONE_PHOTOGRAPHY: "drone-photography",
  CINEMATIC_FILM: "cinematic-film",
  VERTICAL_REEL: "vertical-reel",
  AGENT_BRANDING: "agent-branding",
  SOCIAL_CONTENT: "social-content",
  FLOOR_PLAN: "floor-plan",
  PROPERTY_WEBSITE: "property-website",
  MATTERPORT: "matterport",
  OTHER: "other",
};

export function isUploadMediaCategory(
  value: unknown,
): value is UploadMediaCategory {
  return (
    typeof value === "string" &&
    MEDIA_CATEGORIES.includes(
      value as UploadMediaCategory,
    )
  );
}

export function validateImageUpload(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (!IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported image type.");
  }

  const maxSize = 25 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      "Images must be smaller than 25 MB.",
    );
  }
}

function extensionFromMime(type: string) {
  switch (type) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/avif":
      return "avif";

    default:
      return "bin";
  }
}

export function createImageKey(
  projectId: string,
  mimeType: string,
  mediaCategory: UploadMediaCategory = "PHOTOGRAPHY",
) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");

  const id = randomUUID().slice(0, 8);
  const extension = extensionFromMime(mimeType);
  const folder =
    MEDIA_CATEGORY_FOLDERS[mediaCategory];

  return `projects/${projectId}/${folder}/${timestamp}-${id}.${extension}`;
}

export function createServiceImageKey(projectId: string, serviceFolder: string, mimeType: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const id = randomUUID().slice(0, 8);
  return `projects/${projectId}/${serviceFolder}/${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createTestimonialImageKey(workspaceId: string, mimeType: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const id = randomUUID().slice(0, 8);

  return `${brandAssetPrefix(workspaceId, "testimonials")}${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createBlogImageKey(workspaceId: string, mimeType: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const id = randomUUID().slice(0, 8);
  return `${brandAssetPrefix(workspaceId, "blog")}${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createLocationFeatureImageKey(workspaceId: string, locationId: string, mimeType: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const safeWorkspace = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeLocation = locationId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `site/locations/${safeWorkspace}/${safeLocation}/${timestamp}-${randomUUID().slice(0, 8)}.${extensionFromMime(mimeType)}`;
}

export function createNewsletterAiImageKey(workspaceId: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `${brandAssetPrefix(workspaceId, "newsletter-ai")}${timestamp}-${randomUUID()}.webp`;
}

export function createTrustedLogoKey(workspaceId: string, mimeType: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const id = randomUUID().slice(0, 8);

  return `${brandAssetPrefix(workspaceId, "trusted-logos")}${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createSiteHeroKey(
  workspaceId: string,
  kind: "video" | "poster",
  mimeType: string,
) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const id = randomUUID().slice(0, 8);

  const extension =
    mimeType === "video/mp4"
      ? "mp4"
      : mimeType === "video/webm"
        ? "webm"
        : extensionFromMime(mimeType);

  return `${brandAssetPrefix(workspaceId, "site-hero")}${kind}-${timestamp}-${id}.${extension}`;
}

export function createHomepageSectionImageKey(
  workspaceId: string,
  kind: "helios-standard" | "primary-conversion",
  mimeType: string,
) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const id = randomUUID().slice(0, 8);

  return `${brandAssetPrefix(workspaceId, "site-homepage")}${kind}-${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createBrandLogoKey(workspaceId: string, mimeType: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const id = randomUUID().slice(0, 8);

  return `${brandAssetPrefix(workspaceId, "site-brand")}logo-${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createBrandMonogramKey(workspaceId: string, mimeType: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const id = randomUUID().slice(0, 8);

  return `${brandAssetPrefix(workspaceId, "site-brand")}monogram-${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createFaviconKey(workspaceId: string, mimeType: string) {
  const timestamp = Date.now();
  return `${brandAssetPrefix(workspaceId, "site-brand")}favicon-${timestamp}-${randomUUID().slice(0, 8)}.${extensionFromMime(mimeType)}`;
}

export function createDefaultSocialImageKey(workspaceId: string, mimeType: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `${brandAssetPrefix(workspaceId, "site-brand")}social-${timestamp}-${randomUUID().slice(0, 8)}.${extensionFromMime(mimeType)}`;
}

export function createFeaturedFilmKey(kind: "video" | "poster", mimeType: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const id = randomUUID().slice(0, 8);
  const extension = mimeType === "video/mp4" ? "mp4" : mimeType === "video/webm" ? "webm" : extensionFromMime(mimeType);

  return `site/homepage/featured-film/${kind}-${timestamp}-${id}.${extension}`;
}

export function createHomepageWorkCardKey(
  cardId: string,
  kind: "image" | "video",
  mimeType: string,
) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const id = randomUUID().slice(0, 8);
  const extension = kind === "video"
    ? mimeType === "video/mp4" ? "mp4" : "webm"
    : extensionFromMime(mimeType);

  return `site/homepage/work-cards/${cardId}/${kind}-${timestamp}-${id}.${extension}`;
}

export function createAboutPageImageKey(
  workspaceId: string,
  kind: "hero" | "founder" | "gallery-one" | "gallery-two" | "gallery-three",
  mimeType: string,
) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const id = randomUUID().slice(0, 8);
  return `${brandAssetPrefix(workspaceId, "about")}${kind}-${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createPhotoComparisonImageKey(
  workspaceId: string,
  kind: "detail" | "standard" | "editorial",
  mimeType: string,
) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `${brandAssetPrefix(workspaceId, "photo-comparison")}${kind}-${timestamp}-${randomUUID().slice(0, 8)}.${extensionFromMime(mimeType)}`;
}

export function createEmailCampaignImageKey(mimeType: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const id = randomUUID().slice(0, 8);

  return `email/campaigns/${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export function createNewsletterImageKey(workspaceId: string, mimeType: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  return `${brandAssetPrefix(workspaceId, "newsletter")}${timestamp}-${randomUUID().slice(0, 8)}.${extensionFromMime(mimeType)}`;
}

export function createTeamMemberPortraitKey(workspaceId: string, mimeType: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const id = randomUUID().slice(0, 8);
  return `${brandAssetPrefix(workspaceId, "team")}${timestamp}-${id}.${extensionFromMime(mimeType)}`;
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
) {
  const command = new PutObjectCommand({
    Bucket: r2Config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2Client, command, {
    expiresIn: 60 * 5,
  });
}

export async function createPresignedDownloadUrl(
  key: string,
) {
  return getSignedUrl(
    r2Client,
    new GetObjectCommand({
      Bucket: r2Config.bucketName,
      Key: key,
    }),
    {
      expiresIn: 60,
    },
  );
}

export function getPublicAssetUrl(key: string) {
  return `${r2Config.publicUrl}/${key}`;
}
