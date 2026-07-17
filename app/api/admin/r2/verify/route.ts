import {
  ListObjectsV2Command,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { r2Client, r2Config } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    environment: true,
    credentials: false,
    endpoint: false,
    bucket: false,
    publicUrlFormat: false,
  };

  try {
    const publicUrl = new URL(r2Config.publicUrl);

    checks.publicUrlFormat =
      publicUrl.protocol === "https:" ||
      publicUrl.protocol === "http:";

    await r2Client.send(
      new ListObjectsV2Command({
        Bucket: r2Config.bucketName,
        MaxKeys: 1,
      }),
    );

    checks.credentials = true;
    checks.endpoint = true;
    checks.bucket = true;

    return NextResponse.json({
      success: true,
      checks,
      message: "Cloudflare R2 bucket connection succeeded.",
    });
  } catch (error) {
    let code = "UNKNOWN_ERROR";
    let message = "Cloudflare R2 connection failed.";

    if (error instanceof S3ServiceException) {
      code = error.name;

      switch (error.name) {
        case "InvalidAccessKeyId":
          message =
            "The R2 Access Key ID was rejected. Confirm that the Access Key ID belongs to the current R2 token.";
          break;

        case "SignatureDoesNotMatch":
          message =
            "The R2 credentials did not match. Confirm that the Access Key ID and Secret Access Key came from the same token.";
          break;

        case "AccessDenied":
          message =
            "The credentials are valid, but the token does not have permission to read this bucket.";
          checks.credentials = true;
          checks.endpoint = true;
          break;

        case "NoSuchBucket":
          message =
            "The R2 connection succeeded, but the configured bucket name was not found.";
          checks.credentials = true;
          checks.endpoint = true;
          break;

        default:
          message = `Cloudflare R2 returned ${error.name}.`;
      }
    } else if (error instanceof TypeError) {
      code = "INVALID_CONFIGURATION";
      message =
        "The R2 endpoint or public URL is not formatted correctly.";
    } else if (error instanceof Error) {
      code = error.name || "CONNECTION_ERROR";
    }

    return NextResponse.json(
      {
        success: false,
        checks,
        error: {
          code,
          message,
        },
      },
      { status: 500 },
    );
  }
}