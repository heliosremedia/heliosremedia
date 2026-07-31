export const PROJECT_MEDIA_MAX_IMAGE_UPLOAD_MIB = 50;
export const PROJECT_MEDIA_MAX_IMAGE_UPLOAD_BYTES =
  PROJECT_MEDIA_MAX_IMAGE_UPLOAD_MIB * 1024 * 1024;

export const PROJECT_MEDIA_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export function formatProjectMediaFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kibibytes = bytes / 1024;
  if (kibibytes < 1024) return `${kibibytes.toFixed(1)} KB`;
  return `${(kibibytes / 1024).toFixed(1)} MB`;
}

export function getProjectMediaImageValidationError(file: {
  type: string;
  size: number;
}) {
  if (!PROJECT_MEDIA_IMAGE_MIME_TYPES.has(file.type)) {
    return "Only JPG, PNG, WebP, and AVIF images are supported.";
  }

  if (file.size > PROJECT_MEDIA_MAX_IMAGE_UPLOAD_BYTES) {
    return `Image exceeds the ${PROJECT_MEDIA_MAX_IMAGE_UPLOAD_MIB} MB upload limit (actual size: ${formatProjectMediaFileSize(file.size)}, ${file.size.toLocaleString("en-US")} bytes).`;
  }

  return null;
}
