import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createImageKey,
  createServiceImageKey,
  createPresignedUploadUrl,
  getPublicAssetUrl,
  isUploadMediaCategory,
  validateImageUpload,
} from "@/lib/r2-upload";
import { requireAdminSession } from "@/lib/auth/session";
import { mediaFolderForService } from "@/lib/service-media";

type PresignRequestBody = {
  projectId?: unknown;
  fileName?: unknown;
  fileType?: unknown;
  fileSize?: unknown;
  mediaCategory?: unknown;
  serviceId?: unknown;
};

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body =
      (await request.json()) as PresignRequestBody;

    const projectId =
      typeof body.projectId === "string"
        ? body.projectId.trim()
        : "";

    const fileName =
      typeof body.fileName === "string"
        ? body.fileName.trim()
        : "";

    const fileType =
      typeof body.fileType === "string"
        ? body.fileType.trim()
        : "";

    const fileSize =
      typeof body.fileSize === "number"
        ? body.fileSize
        : Number.NaN;

    const mediaCategory =
      body.mediaCategory === undefined
        ? "PHOTOGRAPHY"
        : body.mediaCategory;
    const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: "A project ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !fileName ||
      !fileType ||
      !Number.isFinite(fileSize)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Valid file information is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isUploadMediaCategory(mediaCategory)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid media category is required.",
        },
        {
          status: 400,
        },
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: session.workspaceId },
      select: {
        id: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found.",
        },
        {
          status: 404,
        },
      );
    }

    validateImageUpload({
      name: fileName,
      type: fileType,
      size: fileSize,
    });

    const service = serviceId ? await prisma.service.findFirst({
      where: { id: serviceId, workspaceId: session.workspaceId, active: true, archivedAt: null },
      select: { id: true, slug: true },
    }) : null;
    if (serviceId && !service) return NextResponse.json({ success: false, error: "The selected service is not available." }, { status: 409 });
    const key = service
      ? createServiceImageKey(project.id, mediaFolderForService(service), fileType)
      : createImageKey(project.id, fileType, mediaCategory);

    const uploadUrl =
      await createPresignedUploadUrl(
        key,
        fileType,
      );

    return NextResponse.json({
      success: true,
      upload: {
        key,
        uploadUrl,
        publicUrl: getPublicAssetUrl(key),
        contentType: fileType,
        mediaCategory,
        serviceId: service?.id ?? null,
      },
    });
  } catch (error) {
    console.error(
      "Unable to create R2 upload URL:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to prepare this upload.";

    const isValidationError =
      message === "Unsupported image type." ||
      message ===
        "Images must be smaller than 25 MB.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: isValidationError ? 400 : 500,
      },
    );
  }
}
