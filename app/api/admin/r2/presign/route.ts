import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { r2Config } from "@/lib/r2";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createImageKey,
  createServiceImageKey,
  createPresignedUploadUrl,
  getPublicAssetUrl,
  isUploadMediaCategory,
} from "@/lib/r2-upload";
import { getAdminSession } from "@/lib/auth/session";
import { mediaFolderForService } from "@/lib/service-media";
import { getProjectMediaImageValidationError } from "@/lib/project-media-upload";

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
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
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

    const validationError = getProjectMediaImageValidationError({ type: fileType, size: fileSize });
    if (validationError || !Number.isSafeInteger(fileSize) || fileSize <= 0) return NextResponse.json({ success: false, error: validationError || "Valid file information is required." }, { status: 400 });

    const prepared = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, session);
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId} AND "workspaceId"=${session.workspaceId} FOR SHARE`;
      const project = await tx.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { id: true } });
      if (!project) throw new Error("UPLOAD_PROJECT_NOT_FOUND");
      if (serviceId) await tx.$queryRaw`SELECT id FROM "Service" WHERE id=${serviceId} AND "workspaceId"=${session.workspaceId} FOR SHARE`;
      const service = serviceId ? await tx.service.findFirst({
        where: { id: serviceId, workspaceId: session.workspaceId, active: true, archivedAt: null }, select: { id: true, slug: true },
      }) : null;
      if (serviceId && !service) throw new Error("UPLOAD_SERVICE_UNAVAILABLE");
      const key = service ? createServiceImageKey(project.id, mediaFolderForService(service), fileType) : createImageKey(project.id, fileType, mediaCategory);
      if (!r2Config.accountId || !r2Config.bucketName) throw new Error("UPLOAD_STORAGE_UNAVAILABLE");
      const asset = await tx.workspaceAsset.create({ data: {
        workspaceId: session.workspaceId, provider: "R2", providerNamespace: JSON.stringify([r2Config.accountId, r2Config.bucketName]),
        providerKey: key, byteSize: BigInt(fileSize), provenance: { kind: "PROJECT_IMAGE_UPLOAD", projectId: project.id, serviceId: service?.id ?? null, mediaCategory, actorId: session.userId },
      }, select: { id: true } });
      return { assetId: asset.id, key, service };
    });
    const { key, service } = prepared;
    const assetWhere = { id: prepared.assetId, workspaceId: session.workspaceId, status: "UPLOAD_PENDING" as const };
    let uploadUrl: string;
    try {
      uploadUrl = await createPresignedUploadUrl(key, fileType);
      const changed = await prisma.workspaceAsset.updateMany({ where: assetWhere, data: { status: "UPLOAD_PROVISIONED" } });
      if (changed.count !== 1) throw new Error("UPLOAD_SETTLEMENT_FAILED");
    } catch (error) {
      await prisma.workspaceAsset.updateMany({ where: assetWhere, data: { status: "FAILED" } }).catch((failure) => { console.error("Unable to record failed project upload:", failure); });
      throw error;
    }

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
    const code = error instanceof Error ? error.message : "";
    if (code === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Upload access is no longer available." }, { status: 403 });
    if (code === "UPLOAD_PROJECT_NOT_FOUND") return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
    if (code === "UPLOAD_SERVICE_UNAVAILABLE") return NextResponse.json({ success: false, error: "The selected service is not available." }, { status: 409 });
    console.error(
      "Unable to create R2 upload URL:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to prepare this upload.";

    const isValidationError = message.startsWith("Image exceeds the 50 MB upload limit") || message.startsWith("Only JPG");

    return NextResponse.json(
      {
        success: false,
        error: isValidationError ? message : "Unable to prepare this upload.",
      },
      {
        status: isValidationError ? 400 : 500,
      },
    );
  }
}
