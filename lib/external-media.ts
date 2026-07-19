export type ExternalMediaProvider =
  | "YOUTUBE"
  | "VIMEO"
  | "DROPBOX"
  | "DIRECT_VIDEO"
  | "OTHER";

export type ExternalMediaDetails = {
  provider: ExternalMediaProvider;
  databaseProvider: "YOUTUBE" | "VIMEO" | "OTHER";
  sourceType: "VIDEO_EMBED" | "EXTERNAL_LINK";
  externalUrl: string;
  externalId: string | null;
  embedUrl: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  label: string;
};

const VIDEO_EXTENSIONS = /\.(mp4|m4v|webm|mov)(?:$|[?#])/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function normalizeHttpUrl(value: string) {
  const candidate = value.trim();

  if (!candidate) {
    throw new Error("Enter a video URL.");
  }

  if (candidate.length > 2048) {
    throw new Error("The video URL is too long.");
  }

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a complete URL beginning with https://.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only secure web video links are supported.");
  }

  if (url.protocol === "http:") {
    url.protocol = "https:";
  }

  url.hash = "";
  return url;
}

function getYouTubeId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate = "";

  if (hostname === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "music.youtube.com"
  ) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v") ?? "";
    } else {
      const segments = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(segments[0] ?? "")) {
        candidate = segments[1] ?? "";
      }
    }
  }

  return YOUTUBE_ID.test(candidate) ? candidate : null;
}

function isYouTubeHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return [
    "youtu.be",
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
  ].includes(normalized);
}

function getVimeoId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") {
    return null;
  }

  const numericSegment = url.pathname
    .split("/")
    .filter(Boolean)
    .find((segment) => /^\d+$/.test(segment));

  return numericSegment ?? null;
}

function isDropboxHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return (
    normalized === "dropbox.com" ||
    normalized === "dl.dropboxusercontent.com"
  );
}

function getDropboxPlaybackUrl(url: URL) {
  if (url.hostname.toLowerCase().replace(/^www\./, "") === "dropbox.com") {
    url.hostname = "www.dropbox.com";
    url.searchParams.delete("dl");
    url.searchParams.set("raw", "1");
  }

  return url.toString();
}

export function resolveExternalMedia(value: string): ExternalMediaDetails {
  const url = normalizeHttpUrl(value);
  const youtubeId = getYouTubeId(url);

  if (youtubeId) {
    return {
      provider: "YOUTUBE",
      databaseProvider: "YOUTUBE",
      sourceType: "VIDEO_EMBED",
      externalUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      externalId: youtubeId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`,
      playbackUrl: null,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      label: "YouTube",
    };
  }

  if (isYouTubeHost(url.hostname)) {
    throw new Error("This YouTube link does not contain a valid video ID.");
  }

  const vimeoId = getVimeoId(url);

  if (vimeoId) {
    return {
      provider: "VIMEO",
      databaseProvider: "VIMEO",
      sourceType: "VIDEO_EMBED",
      externalUrl: `https://vimeo.com/${vimeoId}`,
      externalId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?dnt=1`,
      playbackUrl: null,
      thumbnailUrl: null,
      label: "Vimeo",
    };
  }

  if (url.hostname.toLowerCase().replace(/^www\./, "").endsWith("vimeo.com")) {
    throw new Error("This Vimeo link does not contain a valid video ID.");
  }

  if (isDropboxHost(url.hostname)) {
    if (!VIDEO_EXTENSIONS.test(url.pathname)) {
      throw new Error("Use a Dropbox shared link that points directly to a video file.");
    }

    return {
      provider: "DROPBOX",
      databaseProvider: "OTHER",
      sourceType: "VIDEO_EMBED",
      externalUrl: url.toString(),
      externalId: null,
      embedUrl: null,
      playbackUrl: getDropboxPlaybackUrl(new URL(url)),
      thumbnailUrl: null,
      label: "Dropbox",
    };
  }

  if (VIDEO_EXTENSIONS.test(url.pathname)) {
    return {
      provider: "DIRECT_VIDEO",
      databaseProvider: "OTHER",
      sourceType: "VIDEO_EMBED",
      externalUrl: url.toString(),
      externalId: null,
      embedUrl: null,
      playbackUrl: url.toString(),
      thumbnailUrl: null,
      label: "Hosted video",
    };
  }

  return {
    provider: "OTHER",
    databaseProvider: "OTHER",
    sourceType: "EXTERNAL_LINK",
    externalUrl: url.toString(),
    externalId: null,
    embedUrl: null,
    playbackUrl: null,
    thumbnailUrl: null,
    label: "External link",
  };
}

export function tryResolveExternalMedia(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return resolveExternalMedia(value);
  } catch {
    return null;
  }
}
