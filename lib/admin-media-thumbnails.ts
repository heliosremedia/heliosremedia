export const ADMIN_MEDIA_THUMBNAIL_WIDTHS = [360, 640] as const;

export function getAdminMediaThumbnailKey(mediaId: string, width: number) {
  return `system/admin-media-thumbnails/${mediaId}/${width}.webp`;
}
