import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { HdPhotoHubError, isHdPhotoHubConfigured } from "@/lib/client-portal/hdphotohub";
import { syncHdPhotoHubClients } from "@/lib/client-communications/sync";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Administrator access is required to sync clients." },
      { status: 403 },
    );
  }
  const provider = { key: "hdphotohub", label: "HDPhotoHub" };
  if (!isHdPhotoHubConfigured()) {
    await prisma.clientSyncRun.create({
      data: {
        workspaceId: session.workspaceId,
        providerKey: provider.key,
        providerLabel: provider.label,
        status: "FAILED",
        errorCount: 1,
        errorCategory: "NOT_CONFIGURED",
        completedAt: new Date(),
      },
    });
    return NextResponse.json(
      { success: false, error: "The configured client provider is not connected." },
      { status: 503 },
    );
  }

  const run = await prisma.clientSyncRun.create({
    data: {
      workspaceId: session.workspaceId,
      providerKey: provider.key,
      providerLabel: provider.label,
      status: "RUNNING",
    },
  });
  try {
    const result = await syncHdPhotoHubClients();
    const skipped = Math.max(0, result.total - result.created - result.updated);
    await prisma.clientSyncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        importedCount: result.created,
        updatedCount: result.updated,
        skippedCount: skipped,
        completedAt: new Date(),
      },
    });
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "HDPH_CLIENTS_SYNCED",
      entityType: "CommunicationClient",
      summary: `${result.total} HDPhotoHub clients synchronized (${result.created} new, ${result.updated} updated).`,
      metadata: {
        total: result.total,
        created: result.created,
        updated: result.updated,
      },
    });
    revalidatePath("/admin/clients");
    return NextResponse.json({ success: true, provider: provider.label, skipped, ...result });
  } catch (error) {
    console.error("Unable to sync HDPhotoHub clients:", error);
    const message =
      error instanceof HdPhotoHubError
        ? error.message
        : "Clients could not be synchronized.";
    await prisma.clientSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorCount: 1,
        errorCategory: error instanceof HdPhotoHubError ? "PROVIDER_REJECTED" : "UNKNOWN",
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
