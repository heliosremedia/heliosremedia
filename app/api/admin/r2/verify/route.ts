import {
  ListObjectsV2Command,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { requireLockedWorkspaceAdministrator } from "@/lib/workspace-write-access";
import { tenantContextEnabled } from "@/lib/workspace-context-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // This probes the shared platform bucket, not a tenant-owned integration.
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role) || tenantContextEnabled()) {
      return NextResponse.json({ success: false, error: "Storage diagnostics are not available in this context." }, { status: 403 });
    }
    await prisma.$transaction(async tx => {
      await requireLockedWorkspaceAdministrator(tx, session);
      await tx.$executeRaw`LOCK TABLE "Workspace" IN SHARE MODE`;
      const companies = await tx.workspace.findMany({ take: 2, select: { id: true } });
      if (companies.length !== 1 || companies[0].id !== session.workspaceId) throw new Error("STORAGE_DIAGNOSTIC_FORBIDDEN");
    });
  } catch (error) {
    if (error instanceof Error && ["WORKSPACE_WRITE_FORBIDDEN", "STORAGE_DIAGNOSTIC_FORBIDDEN"].includes(error.message)) {
      return NextResponse.json({ success: false, error: "Storage diagnostics are not available in this context." }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Storage diagnostics are temporarily unavailable." }, { status: 503 });
  }
  const checks = {
    environment: true,
    credentials: false,
    endpoint: false,
    bucket: false,
    publicUrlFormat: false,
  };

  try {
    const { r2Client, r2Config } = await import("@/lib/r2");
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
      code = ["InvalidAccessKeyId", "SignatureDoesNotMatch", "AccessDenied", "NoSuchBucket"].includes(error.name) ? error.name : "PROVIDER_ERROR";

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
          message = "Cloudflare R2 could not complete the connection check.";
      }
    } else if (error instanceof TypeError) {
      code = "INVALID_CONFIGURATION";
      message =
        "The R2 endpoint or public URL is not formatted correctly.";
    } else if (error instanceof Error) {
      code = "CONNECTION_ERROR";
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