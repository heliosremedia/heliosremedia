import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { HdPhotoHubError, isHdPhotoHubConfigured } from "@/lib/client-portal/hdphotohub";
import { syncHdPhotoHubClients } from "@/lib/client-communications/sync";

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
  if (!isHdPhotoHubConfigured()) {
    return NextResponse.json(
      { success: false, error: "HDPhotoHub is not connected." },
      { status: 503 },
    );
  }

  try {
    const result = await syncHdPhotoHubClients();
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
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Unable to sync HDPhotoHub clients:", error);
    const message =
      error instanceof HdPhotoHubError
        ? error.message
        : "Clients could not be synchronized.";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
