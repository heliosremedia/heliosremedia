import { resolveExternalMedia } from "@/lib/external-media";
import { getPublicAssetUrl } from "@/lib/r2-upload";

type CardMedia = {
  sourceType: string;
  provider: string | null;
  storageKey: string | null;
  externalUrl: string | null;
  externalId: string | null;
};

export function getHomepageCardVideo(card: {
  mediaMode: string;
  videoUrl: string | null;
  featuredMedia: CardMedia | null;
}) {
  if (card.mediaMode === "UPLOADED_VIDEO" && card.videoUrl) {
    return { videoSrc: card.videoUrl, embedSrc: null, thumbnailUrl: null };
  }

  if (card.mediaMode !== "LIBRARY_VIDEO" || !card.featuredMedia) {
    return { videoSrc: null, embedSrc: null, thumbnailUrl: null };
  }

  const media = card.featuredMedia;
  if (media.sourceType === "UPLOADED_VIDEO" && media.storageKey) {
    return { videoSrc: getPublicAssetUrl(media.storageKey), embedSrc: null, thumbnailUrl: null };
  }
  if (media.provider === "YOUTUBE" && media.externalId) {
    const id = media.externalId;
    return {
      videoSrc: null,
      embedSrc: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  if (media.provider === "VIMEO" && media.externalId) {
    return {
      videoSrc: null,
      embedSrc: `https://player.vimeo.com/video/${media.externalId}?autoplay=1&muted=1&background=1&loop=1&dnt=1`,
      thumbnailUrl: null,
    };
  }
  if (media.externalUrl) {
    try {
      const resolved = resolveExternalMedia(media.externalUrl);
      const embedSrc =
        resolved.provider === "CLOUDFLARE_STREAM" && resolved.embedUrl
          ? `${resolved.embedUrl}?autoplay=true&muted=true&loop=true&controls=false&preload=metadata`
          : resolved.embedUrl;

      return {
        videoSrc: resolved.playbackUrl,
        embedSrc,
        thumbnailUrl: resolved.thumbnailUrl,
      };
    } catch {
      return { videoSrc: null, embedSrc: null, thumbnailUrl: null };
    }
  }
  return { videoSrc: null, embedSrc: null, thumbnailUrl: null };
}
