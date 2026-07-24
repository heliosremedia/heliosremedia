import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;
const MAX_DURATION_SECONDS = 180;
const UPLOAD_EXPIRY_HOURS = 6;

type StreamUploadRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

function encodeMetadataValue(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

export async function POST(
  request: Request,
  { params }: StreamUploadRouteProps,
) {
  try {
    const { projectId } = await params;
    const uploadLength = Number(request.headers.get("upload-length"));
    const tusVersion = request.headers.get("tus-resumable");
    const requestedMetadata = request.headers.get("upload-metadata")?.trim();

    if (
      !projectId ||
      tusVersion !== "1.0.0" ||
      !Number.isSafeInteger(uploadLength) ||
      uploadLength <= 0 ||
      uploadLength > MAX_VIDEO_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose an MP4 or MOV video no larger than 1 GB.",
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found." },
        { status: 404 },
      );
    }

    const accountId = process.env.CLOUDFLARE_STREAM_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      console.error("Cloudflare Stream environment variables are missing.");
      return NextResponse.json(
        {
          success: false,
          error: "Cloudflare Stream is not configured yet.",
        },
        { status: 503 },
      );
    }

    const constraints = [
      `maxDurationSeconds ${encodeMetadataValue(String(MAX_DURATION_SECONDS))}`,
      `expiry ${encodeMetadataValue(
        new Date(
          Date.now() + UPLOAD_EXPIRY_HOURS * 60 * 60 * 1000,
        ).toISOString(),
      )}`,
    ];
    const uploadMetadata = [requestedMetadata, ...constraints]
      .filter(Boolean)
      .join(",");
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(uploadLength),
          "Upload-Metadata": uploadMetadata,
        },
      },
    );
    const location = response.headers.get("location");

    if (!response.ok || !location) {
      const responseText = await response.text();
      console.error(
        "Cloudflare Stream upload provisioning failed:",
        response.status,
        responseText,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Cloudflare Stream could not prepare this upload.",
        },
        { status: 502 },
      );
    }

    return new NextResponse(null, {
      status: 201,
      headers: {
        Location: location,
        "Tus-Resumable": "1.0.0",
        "Access-Control-Expose-Headers": "Location,Tus-Resumable",
      },
    });
  } catch (error) {
    console.error("Unable to prepare Cloudflare Stream upload:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cloudflare Stream could not prepare this upload.",
      },
      { status: 500 },
    );
  }
}
