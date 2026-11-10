import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, r2Config } from "@/lib/r2";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { eventAdmin } from "@/lib/events/service";
import { eventError } from "@/lib/events/api";
import { safeEventImageUrl } from "@/lib/events/themes";

export async function POST(request: Request) {
  try {
    const session = await eventAdmin();
    const body = await request.json();
    if (!["image/jpeg", "image/png"].includes(body.fileType)) throw new Error("Choose a JPEG or PNG image for email compatibility.");
    if (typeof body.fileSize !== "number" || !Number.isSafeInteger(body.fileSize) || body.fileSize <= 0 || body.fileSize > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
    const workspace = session.workspaceId.replace(/[^a-zA-Z0-9_-]/g, "");
    const key = `event-uploads/${workspace}/${randomUUID()}.${body.fileType === "image/png" ? "png" : "jpg"}`;
    const publicUrl = safeEventImageUrl(getPublicAssetUrl(key), [process.env.R2_PUBLIC_URL]);
    if (!publicUrl) throw new Error("Event image storage is not configured. Contact your administrator.");
    const command = new PutObjectCommand({ Bucket: r2Config.bucketName, Key: key, ContentType: body.fileType, ContentLength: body.fileSize });
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300, signableHeaders: new Set(["content-type", "content-length"]) });
    return NextResponse.json({ success: true, upload: { key, uploadUrl, publicUrl, contentType: body.fileType } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return eventError(error); }
}
