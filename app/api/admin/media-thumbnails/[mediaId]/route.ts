import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { getAdminMediaThumbnailKey } from "@/lib/admin-media-thumbnails";
import { prisma } from "@/lib/prisma";
import { r2Client, r2Config } from "@/lib/r2";

const DEFAULT_WIDTH = 640;
const MIN_WIDTH = 240;
const MAX_WIDTH = 960;

function getThumbnailWidth(request: Request) {
  const requestedWidth = Number(
    new URL(request.url).searchParams.get("width") || DEFAULT_WIDTH,
  );

  if (!Number.isFinite(requestedWidth)) {
    return DEFAULT_WIDTH;
  }

  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(requestedWidth)));
}

function getResponseHeaders(mediaId: string, width: number, version: number) {
  return {
    "Content-Type": "image/webp",
    "Cache-Control": "private, max-age=86400",
    "CDN-Cache-Control": "public, max-age=31536000, immutable",
    ETag: `"${mediaId}-${version}-${width}"`,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const { mediaId } = await params;
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: {
        storageKey: true,
        mimeType: true,
        updatedAt: true,
      },
    });

    if (
      !media?.storageKey ||
      !media.mimeType?.toLowerCase().startsWith("image/")
    ) {
      return new Response("Thumbnail unavailable.", { status: 404 });
    }

    const width = getThumbnailWidth(request);
    const thumbnailKey = getAdminMediaThumbnailKey(mediaId, width);

    try {
      const cachedThumbnail = await r2Client.send(
        new GetObjectCommand({
          Bucket: r2Config.bucketName,
          Key: thumbnailKey,
        }),
      );

      if (cachedThumbnail.Body) {
        const cachedBytes = await cachedThumbnail.Body.transformToByteArray();

        return new Response(new Uint8Array(cachedBytes).buffer, {
          headers: getResponseHeaders(
            mediaId,
            width,
            media.updatedAt.getTime(),
          ),
        });
      }
    } catch {
      // The derivative is created lazily the first time this asset is shown.
    }

    const source = await r2Client.send(
      new GetObjectCommand({
        Bucket: r2Config.bucketName,
        Key: media.storageKey,
      }),
    );

    if (!source.Body) {
      return new Response("Thumbnail source unavailable.", { status: 404 });
    }

    const sourceBytes = await source.Body.transformToByteArray();
    const thumbnail = await sharp(sourceBytes)
      .rotate()
      .resize({
        width,
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality: 76, effort: 3 })
      .toBuffer();

    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: thumbnailKey,
        Body: thumbnail,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return new Response(new Uint8Array(thumbnail), {
      headers: getResponseHeaders(mediaId, width, media.updatedAt.getTime()),
    });
  } catch (error) {
    console.error("Unable to create admin media thumbnail:", error);
    return new Response("Thumbnail unavailable.", { status: 500 });
  }
}
