import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { r2Client, r2Config } from "@/lib/r2";
import { eventAdmin } from "@/lib/events/service";
import { eventError } from "@/lib/events/api";
import { EVENT_IMAGE_MAX_BYTES, eventImageType } from "@/lib/events/images";
import { safeEventImageUrl } from "@/lib/events/themes";

export async function POST(request: Request) {
  try {
    const session = await eventAdmin();
    const { key } = await request.json();
    const workspace = session.workspaceId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (typeof key !== "string" || !new RegExp(`^event-uploads/${workspace}/[a-f0-9-]{36}\\.(?:jpg|png)$`).test(key)) throw new Error("Choose an uploaded image from this workspace.");
    const object = await r2Client.send(new GetObjectCommand({ Bucket: r2Config.bucketName, Key: key }));
    if (!object.Body || !object.ContentLength || object.ContentLength > EVENT_IMAGE_MAX_BYTES) throw new Error("Choose an image smaller than 10 MB.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > EVENT_IMAGE_MAX_BYTES) throw new Error("Choose an image smaller than 10 MB.");
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const contentType = eventImageType(bytes);
    if (object.ContentType !== contentType) throw new Error("The uploaded image type does not match its contents.");
    let safeBytes: Buffer;
    try {
      // Decode every pixel, then write a clean raster without embedded metadata or trailing payloads.
      const decoded = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error", animated: false }).rotate();
      safeBytes = await (contentType === "image/png" ? decoded.png() : decoded.jpeg({ quality: 90 })).toBuffer();
    } catch { throw new Error("This image could not be read. Please export a new JPEG or PNG and retry."); }
    if (safeBytes.length > EVENT_IMAGE_MAX_BYTES) throw new Error("This image is too large after processing. Choose a smaller image.");
    // Final objects have no client-issued PUT URL. Replaying the temporary upload cannot alter an invitation.
    const finalKey = `events/${workspace}/${randomUUID()}.${contentType === "image/png" ? "png" : "jpg"}`;
    const imageUrl = safeEventImageUrl(`${r2Config.publicUrl}/${finalKey}`, [r2Config.publicUrl]);
    if (!imageUrl) throw new Error("Event image storage is not configured. Contact your administrator.");
    await r2Client.send(new PutObjectCommand({ Bucket: r2Config.bucketName, Key: finalKey, Body: safeBytes, ContentType: contentType, ContentLength: safeBytes.length, CacheControl: "public, max-age=31536000, immutable" }));
    return NextResponse.json({ success: true, imageUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return eventError(error); }
}
