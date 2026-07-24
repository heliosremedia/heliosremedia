import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import {
  createTrustedLogoKey,
  getPublicAssetUrl,
  validateImageUpload,
} from "@/lib/r2-upload";
import { r2Client, r2Config } from "@/lib/r2";

const MAX_LOGO_SIZE = 4 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File) || !image.name || !image.type) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose a PNG, WebP, or AVIF logo to upload.",
        },
        { status: 400 },
      );
    }

    validateImageUpload({
      name: image.name,
      type: image.type,
      size: image.size,
    });

    if (image.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Logo files must be smaller than 4 MB.",
        },
        { status: 400 },
      );
    }

    const key = createTrustedLogoKey(image.type);
    const body = Buffer.from(await image.arrayBuffer());

    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: key,
        Body: body,
        ContentType: image.type,
      }),
    );

    return NextResponse.json({
      success: true,
      upload: {
        key,
        publicUrl: getPublicAssetUrl(key),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to upload this logo.";
    const validation =
      message === "Unsupported image type." ||
      message === "Images must be smaller than 25 MB.";

    console.error("Unable to upload trusted logo:", error);

    return NextResponse.json(
      {
        success: false,
        error: validation ? message : "The logo could not be uploaded.",
      },
      { status: validation ? 400 : 500 },
    );
  }
}
