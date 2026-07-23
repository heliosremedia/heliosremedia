const STREAM_UID = /^[a-f0-9]{32}$/i;

type StreamEnvironmentVariable =
  | "CLOUDFLARE_STREAM_ACCOUNT_ID"
  | "CLOUDFLARE_STREAM_API_TOKEN";

function getRequiredEnvironmentVariable(name: StreamEnvironmentVariable) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function isCloudflareStreamUid(value: unknown): value is string {
  return typeof value === "string" && STREAM_UID.test(value);
}

export function getCloudflareStreamEmbedUrl(uid: string) {
  if (!isCloudflareStreamUid(uid)) {
    throw new Error("Invalid Cloudflare Stream video ID.");
  }

  return `https://iframe.videodelivery.net/${uid}`;
}

export function getCloudflareStreamThumbnailUrl(
  uid: string,
  timeSeconds = 1,
) {
  if (!isCloudflareStreamUid(uid)) {
    throw new Error("Invalid Cloudflare Stream video ID.");
  }

  const safeTime = Math.max(0, Math.min(timeSeconds, 3600));
  return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=${safeTime}s&fit=crop`;
}

export async function deleteCloudflareStreamVideo(uid: string) {
  if (!isCloudflareStreamUid(uid)) {
    return;
  }

  const accountId = getRequiredEnvironmentVariable(
    "CLOUDFLARE_STREAM_ACCOUNT_ID",
  );
  const apiToken = getRequiredEnvironmentVariable(
    "CLOUDFLARE_STREAM_API_TOKEN",
  );
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Cloudflare Stream rejected the delete request with status ${response.status}.`,
    );
  }
}
