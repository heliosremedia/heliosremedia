import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isMediaCategory } from "@/lib/media-collections";
import {
  deleteCloudflareStreamVideo,
  getCloudflareStreamEmbedUrl,
  isCloudflareStreamUid,
} from "@/lib/cloudflare-stream";
import { resolveExternalMedia } from "@/lib/external-media";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { r2Client, r2Config } from "@/lib/r2";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { mediaCategoryForServiceSlug, mediaFolderForService } from "@/lib/service-media";
import { getProjectMediaImageValidationError } from "@/lib/project-media-upload";

type MediaRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type CreateMediaRequestBody = {
  streamUid?: unknown;
  externalUrl?: unknown;
  key?: unknown;
  originalFilename?: unknown;
  altText?: unknown;
  caption?: unknown;
  visibility?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
  width?: unknown;
  height?: unknown;
  mediaCategory?: unknown;
  serviceId?: unknown;
};

type UpdateMediaRequestBody = {
  action?: unknown;
  mediaId?: unknown;
  externalUrl?: unknown;
  mediaCategory?: unknown;
  serviceId?: unknown;
  mediaIds?: unknown;
  originalFilename?: unknown;
  altText?: unknown;
  caption?: unknown;
  visibility?: unknown;
};

type DeleteMediaRequestBody = {
  mediaId?: unknown;
};

class StaleMediaCollectionError extends Error {
  constructor() {
    super("The media collection changed before the new order was saved.");
    this.name = "StaleMediaCollectionError";
  }
}

function getOptionalDimension(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function getOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(_request: Request, { params }: MediaRouteProps) {
  try {
    const { projectId } = await params;
    const session = await requireAdminSession();

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

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: session.workspaceId },
      select: {
        id: true,
        heroMediaId: true,
        socialImageMediaId: true,
        collectionHeroes: {
          select: { mediaId: true, mediaCategory: true, serviceId: true },
        },
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

    const media = await prisma.media.findMany({
      where: {
        projectId,
      },
      orderBy: [
        {
          mediaCategory: "asc",
        },
        {
          displayOrder: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      select: {
        id: true,
        sourceType: true,
        provider: true,
        storageKey: true,
        originalFilename: true,
        altText: true,
        caption: true,
        mimeType: true,
        externalUrl: true,
        externalId: true,
        fileSize: true,
        width: true,
        height: true,
        aspectRatio: true,
        mediaCategory: true,
        serviceId: true,
        displayOrder: true,
        visibility: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      socialImageMediaId: project.socialImageMediaId,
      media: media.map((item) => ({
        ...item,
        publicUrl: item.storageKey ? getPublicAssetUrl(item.storageKey) : "",
        isHero: project.collectionHeroes.some(
          (hero) => hero.mediaId === item.id && hero.serviceId === item.serviceId,
        ),
      })),
      services: await prisma.service.findMany({
        where: { workspaceId: session.workspaceId, archivedAt: null },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, slug: true, description: true, active: true, displayOrder: true, archivedAt: true },
      }),
      projectServiceIds: await prisma.projectService.findMany({ where: { projectId }, select: { serviceId: true } }).then((items) => items.map((item) => item.serviceId)),
    });
  } catch (error) {
    console.error("Unable to load project media:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The project media could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request, { params }: MediaRouteProps) {
  try {
    const { projectId } = await params;
    const session = await requireAdminSession();
    const body = (await request.json()) as CreateMediaRequestBody;
    const requestedServiceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
    const ownedProject = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: session.workspaceId },
      select: { id: true, heroMediaId: true },
    });
    if (!ownedProject) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });

    const externalUrlInput =
      typeof body.externalUrl === "string" ? body.externalUrl.trim() : "";
    const streamUid =
      typeof body.streamUid === "string" ? body.streamUid.trim() : "";

    const key = typeof body.key === "string" ? body.key.trim() : "";

    const originalFilename =
      typeof body.originalFilename === "string"
        ? body.originalFilename.trim()
        : "";

    const mimeType =
      typeof body.mimeType === "string" ? body.mimeType.trim() : "";

    const fileSize =
      typeof body.fileSize === "number" &&
      Number.isInteger(body.fileSize) &&
      body.fileSize >= 0
        ? body.fileSize
        : null;

    const width = getOptionalDimension(body.width);
    const height = getOptionalDimension(body.height);

    const requestedMediaCategory =
      typeof body.mediaCategory === "string" ? body.mediaCategory.trim() : "";
    const resolveRequestedService = async () => {
      if (requestedServiceId) {
        return prisma.service.findFirst({ where: { id: requestedServiceId, workspaceId: session.workspaceId, active: true, archivedAt: null }, select: { id: true, slug: true } });
      }
      return prisma.service.findFirst({
        where: { workspaceId: session.workspaceId, active: true, archivedAt: null },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, slug: true },
      });
    };

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

    if (streamUid) {
      const selectedService = await resolveRequestedService();
      if (!selectedService) return NextResponse.json({ success: false, error: "Choose an active media service." }, { status: 409 });
      const selectedCategory = mediaCategoryForServiceSlug(selectedService.slug);
      const altText = getOptionalText(body.altText);
      const caption = getOptionalText(body.caption);
      const visibility =
        typeof body.visibility === "string" ? body.visibility.trim() : "VISIBLE";

      if (!isCloudflareStreamUid(streamUid)) {
        return NextResponse.json(
          { success: false, error: "Cloudflare returned an invalid video ID." },
          { status: 400 },
        );
      }

      if (!originalFilename || originalFilename.length > 255) {
        return NextResponse.json(
          {
            success: false,
            error: "A video title is required and must be 255 characters or fewer.",
          },
          { status: 400 },
        );
      }

      if ((altText?.length ?? 0) > 500 || (caption?.length ?? 0) > 2000) {
        return NextResponse.json(
          {
            success: false,
            error: "The video description or caption is too long.",
          },
          { status: 400 },
        );
      }

      if (!isMediaCategory(requestedMediaCategory)) {
        return NextResponse.json(
          { success: false, error: "Choose a valid media collection." },
          { status: 400 },
        );
      }

      if (visibility !== "VISIBLE" && visibility !== "HIDDEN") {
        return NextResponse.json(
          { success: false, error: "Choose a valid visibility setting." },
          { status: 400 },
        );
      }

      const project = ownedProject;

      if (!project) {
        return NextResponse.json(
          { success: false, error: "Project not found." },
          { status: 404 },
        );
      }

      const duplicate = await prisma.media.findFirst({
        where: {
          projectId,
          provider: "CLOUDFLARE_STREAM",
          externalId: streamUid,
        },
        select: {
          id: true,
          sourceType: true,
          provider: true,
          storageKey: true,
          originalFilename: true,
          altText: true,
          caption: true,
          mimeType: true,
          externalUrl: true,
          externalId: true,
          fileSize: true,
          width: true,
          height: true,
          aspectRatio: true,
          mediaCategory: true,
          serviceId: true,
          displayOrder: true,
          visibility: true,
          createdAt: true,
        },
      });

      if (duplicate) {
        return NextResponse.json({
          success: true,
          media: { ...duplicate, publicUrl: "", isHero: false },
        });
      }

      const displayOrderResult = await prisma.media.aggregate({
        where: { projectId, serviceId: selectedService.id },
        _max: { displayOrder: true },
      });
      const media = await prisma.media.create({
        data: {
          projectId,
          sourceType: "UPLOADED_VIDEO",
          provider: "CLOUDFLARE_STREAM",
          mediaCategory: selectedCategory,
          serviceId: selectedService.id,
          externalUrl: getCloudflareStreamEmbedUrl(streamUid),
          externalId: streamUid,
          originalFilename,
          altText,
          caption,
          mimeType: mimeType || null,
          fileSize,
          width,
          height,
          aspectRatio: width && height ? width / height : null,
          displayOrder: (displayOrderResult._max.displayOrder ?? -1) + 1,
          visibility,
        },
        select: {
          id: true,
          sourceType: true,
          provider: true,
          storageKey: true,
          originalFilename: true,
          altText: true,
          caption: true,
          mimeType: true,
          externalUrl: true,
          externalId: true,
          fileSize: true,
          width: true,
          height: true,
          aspectRatio: true,
          mediaCategory: true,
          serviceId: true,
          displayOrder: true,
          visibility: true,
          createdAt: true,
        },
      });

      revalidatePath("/portfolio");
      revalidatePath(`/portfolio/${projectId}`);

      return NextResponse.json(
        {
          success: true,
          media: { ...media, publicUrl: "", isHero: false },
        },
        { status: 201 },
      );
    }

    if (externalUrlInput) {
      const selectedService = await resolveRequestedService();
      if (!selectedService) return NextResponse.json({ success: false, error: "Choose an active media service." }, { status: 409 });
      const selectedCategory = mediaCategoryForServiceSlug(selectedService.slug);
      const originalFilename =
        typeof body.originalFilename === "string"
          ? body.originalFilename.trim()
          : "";
      const altText = getOptionalText(body.altText);
      const caption = getOptionalText(body.caption);
      const visibility =
        typeof body.visibility === "string" ? body.visibility.trim() : "VISIBLE";
      const requestedMediaCategory =
        typeof body.mediaCategory === "string" ? body.mediaCategory.trim() : "";

      if (!originalFilename || originalFilename.length > 255) {
        return NextResponse.json(
          {
            success: false,
            error: "A video title is required and must be 255 characters or fewer.",
          },
          { status: 400 },
        );
      }

      if ((altText?.length ?? 0) > 500 || (caption?.length ?? 0) > 2000) {
        return NextResponse.json(
          {
            success: false,
            error: "The video description or caption is too long.",
          },
          { status: 400 },
        );
      }

      if (!isMediaCategory(requestedMediaCategory)) {
        return NextResponse.json(
          {
            success: false,
            error: "Choose a valid media collection.",
          },
          { status: 400 },
        );
      }

      if (visibility !== "VISIBLE" && visibility !== "HIDDEN") {
        return NextResponse.json(
          {
            success: false,
            error: "Choose a valid visibility setting.",
          },
          { status: 400 },
        );
      }

      let resolvedMedia;

      try {
        resolvedMedia = resolveExternalMedia(externalUrlInput);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "The video URL is not supported.",
          },
          { status: 400 },
        );
      }

      const project = ownedProject;

      if (!project) {
        return NextResponse.json(
          { success: false, error: "Project not found." },
          { status: 404 },
        );
      }

      const duplicate = await prisma.media.findFirst({
        where: {
          projectId,
          externalUrl: resolvedMedia.externalUrl,
        },
        select: {
          id: true,
          sourceType: true,
          provider: true,
          storageKey: true,
          originalFilename: true,
          altText: true,
          caption: true,
          mimeType: true,
          fileSize: true,
          width: true,
          height: true,
          aspectRatio: true,
          externalUrl: true,
          externalId: true,
          mediaCategory: true,
          serviceId: true,
          displayOrder: true,
          visibility: true,
          createdAt: true,
        },
      });

      if (duplicate) {
        return NextResponse.json({
          success: true,
          media: {
            ...duplicate,
            publicUrl: duplicate.storageKey
              ? getPublicAssetUrl(duplicate.storageKey)
              : "",
            isHero: duplicate.id === project.heroMediaId,
          },
        });
      }

      const displayOrderResult = await prisma.media.aggregate({
        where: {
          projectId,
          serviceId: selectedService.id,
        },
        _max: { displayOrder: true },
      });

      const media = await prisma.media.create({
        data: {
          projectId,
          sourceType: resolvedMedia.sourceType,
          provider: resolvedMedia.databaseProvider,
          mediaCategory: selectedCategory,
          serviceId: selectedService.id,
          externalUrl: resolvedMedia.externalUrl,
          externalId: resolvedMedia.externalId,
          originalFilename,
          altText,
          caption,
          displayOrder: (displayOrderResult._max.displayOrder ?? -1) + 1,
          visibility,
        },
        select: {
          id: true,
          sourceType: true,
          provider: true,
          storageKey: true,
          originalFilename: true,
          altText: true,
          caption: true,
          mimeType: true,
          fileSize: true,
          width: true,
          height: true,
          aspectRatio: true,
          externalUrl: true,
          externalId: true,
          mediaCategory: true,
          serviceId: true,
          displayOrder: true,
          visibility: true,
          createdAt: true,
        },
      });

      return NextResponse.json(
        {
          success: true,
          media: {
            ...media,
            publicUrl: "",
            isHero: false,
          },
        },
        { status: 201 },
      );
    }

    if (!key || !originalFilename || !mimeType || fileSize === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Complete upload information is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (requestedMediaCategory && !isMediaCategory(requestedMediaCategory)) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected media collection is not supported.",
        },
        {
          status: 400,
        },
      );
    }

    const selectedService = requestedServiceId
      ? await prisma.service.findFirst({ where: { id: requestedServiceId, workspaceId: session.workspaceId, active: true, archivedAt: null }, select: { id: true, slug: true } })
      : await prisma.service.findFirst({ where: { workspaceId: session.workspaceId, slug: "photography", active: true, archivedAt: null }, select: { id: true, slug: true } });
    if (!selectedService) return NextResponse.json({ success: false, error: "Select an active service collection." }, { status: 409 });

    const mediaCategory = mediaCategoryForServiceSlug(selectedService.slug);

    if (!isMediaCategory(mediaCategory)) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected media collection is not supported.",
        },
        {
          status: 400,
        },
      );
    }

    if (!mimeType.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Only image uploads are supported right now.",
        },
        {
          status: 400,
        },
      );
    }

    const requestValidationError = getProjectMediaImageValidationError({ type: mimeType, size: fileSize });
    if (requestValidationError) {
      return NextResponse.json({ success: false, error: requestValidationError }, { status: 400 });
    }

    const expectedPrefix = `projects/${projectId}/${mediaFolderForService(selectedService)}/`;

    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The uploaded file does not match the selected media collection.",
        },
        {
          status: 400,
        },
      );
    }

    const project = ownedProject;

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

    let verifiedFileSize = fileSize;
    try {
      const uploadedObject = await r2Client.send(
        new HeadObjectCommand({
          Bucket: r2Config.bucketName,
          Key: key,
        }),
      );
      verifiedFileSize = uploadedObject.ContentLength ?? fileSize;
      const storedObjectValidationError = getProjectMediaImageValidationError({
        type: uploadedObject.ContentType ?? mimeType,
        size: verifiedFileSize,
      });
      if (storedObjectValidationError) {
        return NextResponse.json({ success: false, error: storedObjectValidationError }, { status: 400 });
      }
    } catch (error) {
      console.error("Unable to verify uploaded R2 object:", error);

      return NextResponse.json(
        {
          success: false,
          error: "The uploaded image could not be verified in Cloudflare R2.",
        },
        {
          status: 400,
        },
      );
    }

    const existingMedia = await prisma.media.findFirst({
      where: {
        projectId,
        storageKey: key,
      },
      select: {
        id: true,
        sourceType: true,
        provider: true,
        storageKey: true,
        originalFilename: true,
        altText: true,
        caption: true,
        mimeType: true,
        externalUrl: true,
        externalId: true,
        fileSize: true,
        width: true,
        height: true,
        aspectRatio: true,
        mediaCategory: true,
        serviceId: true,
        displayOrder: true,
        visibility: true,
        createdAt: true,
      },
    });

    if (existingMedia) {
      return NextResponse.json({
        success: true,
        media: {
          ...existingMedia,
          publicUrl: getPublicAssetUrl(key),
          isHero: existingMedia.id === project.heroMediaId,
        },
      });
    }

    const displayOrderResult = await prisma.media.aggregate({
      where: {
        projectId,
        serviceId: selectedService.id,
      },
      _max: {
        displayOrder: true,
      },
    });

    const displayOrder = (displayOrderResult._max.displayOrder ?? -1) + 1;

    const aspectRatio = width && height ? width / height : null;

    const media = await prisma.media.create({
      data: {
        projectId,
        sourceType: "UPLOADED_IMAGE",
        mediaCategory,
        serviceId: selectedService.id,
        storageKey: key,
        originalFilename,
        mimeType,
        fileSize: verifiedFileSize,
        width,
        height,
        aspectRatio,
        displayOrder,
        visibility: "VISIBLE",
      },
      select: {
        id: true,
        sourceType: true,
        provider: true,
        storageKey: true,
        originalFilename: true,
        altText: true,
        caption: true,
        mimeType: true,
        externalUrl: true,
        externalId: true,
        fileSize: true,
        width: true,
        height: true,
        aspectRatio: true,
        mediaCategory: true,
        serviceId: true,
        displayOrder: true,
        visibility: true,
        createdAt: true,
      },
    });

    await prisma.projectService.createMany({ data: [{ projectId, serviceId: selectedService.id }], skipDuplicates: true });

    return NextResponse.json(
      {
        success: true,
        media: {
          ...media,
          publicUrl: getPublicAssetUrl(key),
          isHero: false,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Unable to create project media:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The media asset could not be added to this project.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(request: Request, { params }: MediaRouteProps) {
  try {
    const { projectId } = await params;
    const session = await requireAdminSession();
    const body = (await request.json()) as UpdateMediaRequestBody;
    const ownedProject = await prisma.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { id: true } });
    if (!ownedProject) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });

    const action = typeof body.action === "string" ? body.action.trim() : "";

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

    if (action === "update-asset") {
      const mediaId =
        typeof body.mediaId === "string" ? body.mediaId.trim() : "";
      const originalFilename =
        typeof body.originalFilename === "string"
          ? body.originalFilename.trim()
          : "";
      const altText = getOptionalText(body.altText);
      const caption = getOptionalText(body.caption);
      const requestedMediaCategory =
        typeof body.mediaCategory === "string" ? body.mediaCategory.trim() : "";
      const requestedServiceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
      const destinationService = await prisma.service.findFirst({ where: { id: requestedServiceId, workspaceId: session.workspaceId, active: true, archivedAt: null }, select: { id: true, slug: true } });
      if (!destinationService) return NextResponse.json({ success: false, error: "Select an active service destination." }, { status: 409 });
      const destinationCategory = mediaCategoryForServiceSlug(destinationService.slug);
      const visibility =
        typeof body.visibility === "string" ? body.visibility.trim() : "";
      const externalUrlInput =
        typeof body.externalUrl === "string" ? body.externalUrl.trim() : "";

      if (!mediaId) {
        return NextResponse.json(
          {
            success: false,
            error: "A media ID is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (!originalFilename || originalFilename.length > 255) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The asset filename is required and must be 255 characters or fewer.",
          },
          {
            status: 400,
          },
        );
      }

      if ((altText?.length ?? 0) > 500) {
        return NextResponse.json(
          {
            success: false,
            error: "Alt text must be 500 characters or fewer.",
          },
          {
            status: 400,
          },
        );
      }

      if ((caption?.length ?? 0) > 2000) {
        return NextResponse.json(
          {
            success: false,
            error: "The caption must be 2,000 characters or fewer.",
          },
          {
            status: 400,
          },
        );
      }

      if (!isMediaCategory(requestedMediaCategory)) {
        return NextResponse.json(
          {
            success: false,
            error: "A valid media collection is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (visibility !== "VISIBLE" && visibility !== "HIDDEN") {
        return NextResponse.json(
          {
            success: false,
            error: "A valid visibility setting is required.",
          },
          {
            status: 400,
          },
        );
      }

      const existingMedia = await prisma.media.findFirst({
        where: {
          id: mediaId,
          projectId,
        },
        select: {
          id: true,
          mediaCategory: true,
          serviceId: true,
          sourceType: true,
          externalUrl: true,
        },
      });

      if (!existingMedia) {
        return NextResponse.json(
          {
            success: false,
            error: "The selected asset was not found.",
          },
          {
            status: 404,
          },
        );
      }

      let displayOrder: number | undefined;
      let resolvedExternalMedia:
        | ReturnType<typeof resolveExternalMedia>
        | undefined;

      if (existingMedia.externalUrl) {
        if (!externalUrlInput) {
          return NextResponse.json(
            {
              success: false,
              error: "An external media URL is required for this asset.",
            },
            { status: 400 },
          );
        }

        try {
          resolvedExternalMedia = resolveExternalMedia(externalUrlInput);
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "The external media URL is not supported.",
            },
            { status: 400 },
          );
        }
      }

      if (existingMedia.serviceId !== destinationService.id) {
        const displayOrderResult = await prisma.media.aggregate({
          where: {
            projectId,
            serviceId: destinationService.id,
          },
          _max: {
            displayOrder: true,
          },
        });

        displayOrder = (displayOrderResult._max.displayOrder ?? -1) + 1;

        await prisma.projectMediaCollectionHero.deleteMany({
          where: { projectId, mediaId },
        });
      }

      const updatedMedia = await prisma.media.update({
        where: {
          id: mediaId,
        },
        data: {
          originalFilename,
          altText,
          caption,
          mediaCategory: destinationCategory,
          serviceId: destinationService.id,
          visibility,
          ...(resolvedExternalMedia
            ? {
                sourceType: resolvedExternalMedia.sourceType,
                provider: resolvedExternalMedia.databaseProvider,
                externalUrl: resolvedExternalMedia.externalUrl,
                externalId: resolvedExternalMedia.externalId,
              }
            : {}),
          ...(displayOrder === undefined
            ? {}
            : {
                displayOrder,
              }),
        },
        select: {
          id: true,
          sourceType: true,
          provider: true,
          storageKey: true,
          originalFilename: true,
          altText: true,
          caption: true,
          mimeType: true,
          externalUrl: true,
          externalId: true,
          fileSize: true,
          width: true,
          height: true,
          aspectRatio: true,
        mediaCategory: true,
        serviceId: true,
        displayOrder: true,
          visibility: true,
          createdAt: true,
        },
      });

      const collectionHero = await prisma.projectMediaCollectionHero.findUnique({
        where: {
          projectId_serviceId: {
            projectId,
            serviceId: updatedMedia.serviceId,
          },
        },
        select: { mediaId: true },
      });

      return NextResponse.json({
        success: true,
        media: {
          ...updatedMedia,
          publicUrl: updatedMedia.storageKey
            ? getPublicAssetUrl(updatedMedia.storageKey)
            : "",
          isHero: updatedMedia.id === collectionHero?.mediaId,
        },
      });
    }

    if (action === "reorder") {
      const requestedMediaCategory =
        typeof body.mediaCategory === "string" ? body.mediaCategory.trim() : "";

      if (!isMediaCategory(requestedMediaCategory)) {
        return NextResponse.json(
          {
            success: false,
            error: "A valid media collection is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (!Array.isArray(body.mediaIds) || body.mediaIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "A complete ordered media ID list is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !body.mediaIds.every(
          (value) => typeof value === "string" && value.trim().length > 0,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Every ordered media ID must be valid.",
          },
          {
            status: 400,
          },
        );
      }

      const mediaIds = body.mediaIds.map((value) => value.trim());

      if (new Set(mediaIds).size !== mediaIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "The ordered media ID list contains duplicates.",
          },
          {
            status: 400,
          },
        );
      }

      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
        },
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

      const savedMediaIds = await prisma.$transaction(async (transaction) => {
        const collectionMedia = await transaction.media.findMany({
          where: {
            projectId,
            mediaCategory: requestedMediaCategory,
          },
          orderBy: [
            {
              displayOrder: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
          select: {
            id: true,
          },
        });

        const currentMediaIds = collectionMedia.map((item) => item.id);
        const requestedMediaIdSet = new Set(mediaIds);

        if (
          currentMediaIds.length !== mediaIds.length ||
          currentMediaIds.some((id) => !requestedMediaIdSet.has(id))
        ) {
          throw new StaleMediaCollectionError();
        }

        for (const [index, mediaId] of mediaIds.entries()) {
          await transaction.media.update({
            where: {
              id: mediaId,
            },
            data: {
              displayOrder: -(index + 1),
            },
          });
        }

        for (const [index, mediaId] of mediaIds.entries()) {
          await transaction.media.update({
            where: {
              id: mediaId,
            },
            data: {
              displayOrder: index,
            },
          });
        }

        return mediaIds;
      });

      return NextResponse.json({
        success: true,
        mediaCategory: requestedMediaCategory,
        mediaIds: savedMediaIds,
      });
    }

    if (action === "bulk-update-category") {
      const requestedMediaCategory =
        typeof body.mediaCategory === "string" ? body.mediaCategory.trim() : "";
      const mediaIds = Array.isArray(body.mediaIds)
        ? body.mediaIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())
        : [];
      const requestedServiceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
      const destinationService = await prisma.service.findFirst({ where: { id: requestedServiceId, workspaceId: session.workspaceId, active: true, archivedAt: null }, select: { id: true, name: true, slug: true } });
      if (!destinationService) return NextResponse.json({ success: false, error: "Select an active destination service." }, { status: 409 });
      const destinationCategory = mediaCategoryForServiceSlug(destinationService.slug);

      if (!isMediaCategory(requestedMediaCategory)) {
        return NextResponse.json({ success: false, error: "Select a valid destination collection." }, { status: 400 });
      }
      if (mediaIds.length === 0 || mediaIds.length > 500 || new Set(mediaIds).size !== mediaIds.length) {
        return NextResponse.json({ success: false, error: "Select between 1 and 500 unique assets." }, { status: 400 });
      }

      const result = await prisma.$transaction(async (transaction) => {
        const selectedMedia = await transaction.media.findMany({
          where: { projectId, id: { in: mediaIds } },
          select: { id: true, mediaCategory: true, serviceId: true },
        });
        if (selectedMedia.length !== mediaIds.length) {
          throw new Error("BULK_MEDIA_NOT_FOUND");
        }

        const maximum = await transaction.media.aggregate({
          where: { projectId, serviceId: destinationService.id, id: { notIn: mediaIds } },
          _max: { displayOrder: true },
        });
        const startingDisplayOrder = (maximum._max.displayOrder ?? -1) + 1;
        await transaction.projectMediaCollectionHero.deleteMany({
          where: { projectId, mediaId: { in: mediaIds } },
        });
        await Promise.all(mediaIds.map((id, index) => transaction.media.update({
          where: { id },
          data: { mediaCategory: destinationCategory, serviceId: destinationService.id, displayOrder: startingDisplayOrder + index },
        })));
        await transaction.projectService.createMany({ data: [{ projectId, serviceId: destinationService.id }], skipDuplicates: true });
        return { startingDisplayOrder };
      });

      return NextResponse.json({
        success: true,
        mediaIds,
        mediaCategory: destinationCategory,
        serviceId: destinationService.id,
        message: `${mediaIds.length} ${mediaIds.length === 1 ? "asset" : "assets"} moved to ${destinationService.name}`,
        startingDisplayOrder: result.startingDisplayOrder,
      });
    }

    if (action === "set-hero") {
      const mediaId =
        typeof body.mediaId === "string" ? body.mediaId.trim() : "";

      if (!mediaId) {
        return NextResponse.json(
          {
            success: false,
            error: "A media ID is required.",
          },
          {
            status: 400,
          },
        );
      }

      const media = await prisma.media.findFirst({
        where: {
          id: mediaId,
          projectId,
        },
        select: {
          id: true,
          sourceType: true,
          storageKey: true,
          mediaCategory: true,
          serviceId: true,
          displayOrder: true,
        },
      });

      if (!media || media.sourceType !== "UPLOADED_IMAGE" || !media.storageKey) {
        return NextResponse.json(
          {
            success: false,
            error: "Only uploaded images can be used as the project hero.",
          },
          {
            status: 404,
          },
        );
      }

      await prisma.$transaction(async (transaction) => {
        const collectionMedia = await transaction.media.findMany({
          where: { projectId, serviceId: media.serviceId },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });

        const reorderedIds = [
          media.id,
          ...collectionMedia.filter((item) => item.id !== media.id).map((item) => item.id),
        ];

        for (const [index, id] of reorderedIds.entries()) {
          await transaction.media.update({ where: { id }, data: { displayOrder: index } });
        }

        await transaction.projectMediaCollectionHero.upsert({
          where: {
            projectId_serviceId: {
              projectId,
              serviceId: media.serviceId,
            },
          },
          create: {
            projectId,
            mediaCategory: media.mediaCategory,
            serviceId: media.serviceId,
            mediaId: media.id,
          },
          update: { mediaId: media.id },
        });

        if (media.mediaCategory === "PHOTOGRAPHY") {
          await transaction.project.update({
            where: { id: projectId },
            data: { heroMediaId: media.id },
          });
        }
      });

      revalidatePath("/services");
      revalidatePath("/portfolio");

      return NextResponse.json({
        success: true,
        heroMediaId: media.id,
        mediaCategory: media.mediaCategory,
        serviceId: media.serviceId,
        message: "Hero image set and moved to top",
      });
    }

    if (action === "set-social-image") {
      const session = await requireAdminSession();
      const ownedProject = await prisma.project.findFirst({
        where: { id: projectId, workspaceId: session.workspaceId },
        select: { id: true },
      });
      if (!ownedProject) {
        return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
      }
      const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";
      if (!mediaId) {
        await prisma.project.update({ where: { id: projectId }, data: { socialImageMediaId: null } });
        revalidatePath("/portfolio");
        revalidatePath("/portfolio/[slug]", "page");
        return NextResponse.json({ success: true, socialImageMediaId: null });
      }
      const media = await prisma.media.findFirst({
        where: {
          id: mediaId, projectId, sourceType: "UPLOADED_IMAGE", storageKey: { not: null },
          visibility: "VISIBLE", mimeType: { in: ["image/jpeg", "image/png", "image/webp"] },
        },
        select: { id: true },
      });
      if (!media) {
        return NextResponse.json({ success: false, error: "Choose a visible JPEG, PNG, or WebP project image." }, { status: 400 });
      }
      await prisma.project.update({ where: { id: projectId }, data: { socialImageMediaId: media.id } });
      revalidatePath("/portfolio");
      revalidatePath("/portfolio/[slug]", "page");
      return NextResponse.json({ success: true, socialImageMediaId: media.id });
    }

    return NextResponse.json(
      {
        success: false,
        error: "The requested media action is not supported.",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    if (error instanceof StaleMediaCollectionError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This media collection changed before the new order was saved. Refresh and try again.",
        },
        {
          status: 409,
        },
      );
    }

    console.error("Unable to update project media:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The project media could not be updated.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(request: Request, { params }: MediaRouteProps) {
  try {
    const { projectId } = await params;
    const body = (await request.json()) as DeleteMediaRequestBody;
    const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";

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

    if (!mediaId) {
      return NextResponse.json(
        {
          success: false,
          error: "A media ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        projectId,
      },
      select: {
        id: true,
        storageKey: true,
        provider: true,
        externalId: true,
      },
    });

    if (!media) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected asset was not found.",
        },
        {
          status: 404,
        },
      );
    }

    await prisma.media.delete({
      where: {
        id: media.id,
      },
    });

    let storageCleanupPending = false;

    if (media.storageKey) {
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: r2Config.bucketName,
            Key: media.storageKey,
          }),
        );
      } catch (storageError) {
        storageCleanupPending = true;
        console.error(
          "The media record was deleted, but its R2 object could not be removed:",
          storageError,
        );
      }
    }

    if (
      media.provider === "CLOUDFLARE_STREAM" &&
      media.externalId
    ) {
      try {
        await deleteCloudflareStreamVideo(media.externalId);
      } catch (streamError) {
        storageCleanupPending = true;
        console.error(
          "The media record was deleted, but its Stream video could not be removed:",
          streamError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      deletedMediaId: media.id,
      storageCleanupPending,
    });
  } catch (error) {
    console.error("Unable to delete project media:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The selected asset could not be deleted.",
      },
      {
        status: 500,
      },
    );
  }
}
