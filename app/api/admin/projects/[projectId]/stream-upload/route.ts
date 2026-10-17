import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { isCloudflareStreamUid } from "@/lib/cloudflare-stream";
import { beginStreamUploadAsset, bindStreamUploadAsset, failStreamUploadAsset } from "@/lib/workspace-assets";

const CLIENT_METADATA_KEYS = new Set(["filename", "filetype", "name", "uploadPolicy"]);

function validateClientMetadata(header: string | null): string | null {
  if (!header?.trim()) return "";
  if (header.length > 8192) return null;
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const entry of header.split(",")) {
    const match = /^([A-Za-z][A-Za-z0-9]*)(?: ([A-Za-z0-9+/]*={0,2}))?$/.exec(entry.trim());
    if (!match || !CLIENT_METADATA_KEYS.has(match[1]) || seen.has(match[1])) return null;
    const value = match[2] ?? "";
    if (Buffer.from(value, "base64").toString("base64") !== value) return null;
    seen.add(match[1]);
    entries.push(value ? `${match[1]} ${value}` : match[1]);
  }
  return entries.join(",");
}

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
  let pendingAsset: { id: string; workspaceId: string } | null = null;
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) {
      return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    }
    const { projectId } = await params;
    const uploadLength = Number(request.headers.get("upload-length"));
    const tusVersion = request.headers.get("tus-resumable");
    const requestedMetadata = validateClientMetadata(request.headers.get("upload-metadata"));

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

    if (requestedMetadata === null) {
      return NextResponse.json({ success: false, error: "Upload metadata is invalid." }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: session.workspaceId },
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

    const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY_HOURS * 60 * 60 * 1000);
    const asset = await beginStreamUploadAsset({
      workspaceId: session.workspaceId, projectId, actorId: session.userId, sessionVersion: session.sessionVersion,
      providerNamespace: accountId, byteSize: uploadLength, expiresAt,
    });
    pendingAsset = { id: asset.id, workspaceId: session.workspaceId };
    const constraints = [
      `maxDurationSeconds ${encodeMetadataValue(String(MAX_DURATION_SECONDS))}`,
      `expiry ${encodeMetadataValue(
        expiresAt.toISOString(),
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

    const uid = response.headers.get("stream-media-id")?.trim() ?? "";

    if (!response.ok || !location || !isCloudflareStreamUid(uid)) {
      await failStreamUploadAsset(asset.id, session.workspaceId);
      pendingAsset = null;
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

    await bindStreamUploadAsset({ assetId: asset.id, workspaceId: session.workspaceId, providerNamespace: accountId, uid });
    pendingAsset = null;
    return new NextResponse(null, {
      status: 201,
      headers: {
        Location: location,
        "Tus-Resumable": "1.0.0",
        "Stream-Media-Id": uid,
        "Access-Control-Expose-Headers": "Location,Tus-Resumable,Stream-Media-Id",
      },
    });
  } catch (error) {
    if (pendingAsset) {
      await failStreamUploadAsset(pendingAsset.id, pendingAsset.workspaceId).catch((failure) => {
        console.error("Unable to record failed Stream upload intent:", failure);
      });
    }
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Upload access is no longer available." }, { status: 403 });
    if (error instanceof Error && error.message === "INVALID_ASSET_UPLOAD") return NextResponse.json({ success: false, error: "The project is no longer available for this upload." }, { status: 404 });
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
