import { GetObjectCommand } from "@aws-sdk/client-s3";

import { r2Client, r2Config } from "@/lib/r2";

export const runtime = "nodejs";

const TRUSTED_LOGO_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|webp|avif)$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await context.params;

  if (!TRUSTED_LOGO_FILE.test(fileName)) {
    return new Response("Not found.", { status: 404 });
  }

  try {
    const object = await r2Client.send(
      new GetObjectCommand({
        Bucket: r2Config.bucketName,
        Key: `trusted-logos/${fileName}`,
      }),
    );

    if (!object.Body) {
      return new Response("Not found.", { status: 404 });
    }

    const body = Buffer.from(await object.Body.transformToByteArray());
    const headers = new Headers({
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(body.byteLength),
      "Content-Type": object.ContentType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });

    if (object.ETag) {
      headers.set("ETag", object.ETag);
    }

    return new Response(body, { headers });
  } catch (error) {
    console.error("Unable to load trusted logo asset:", error);
    return new Response("Not found.", { status: 404 });
  }
}
