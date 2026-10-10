import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { updateAdminMarketingPreference } from "@/lib/client-communications/admin-preference";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }
  const input = await request.json() as {
    clientId?: string;
    action?: string;
    consentSource?: string;
    reason?: string;
    confirmation?: boolean;
  };
  if (typeof input.clientId !== "string" || !input.clientId || input.clientId.length > 100 || !["unsubscribe", "resubscribe"].includes(input.action ?? "") || (input.reason !== undefined && typeof input.reason !== "string") || (input.consentSource !== undefined && typeof input.consentSource !== "string")) {
    return NextResponse.json({ success: false, error: "A client and preference action are required." }, { status: 400 });
  }
  if (input.action === "resubscribe" && (input.confirmation !== true || !input.consentSource?.trim())) {
    return NextResponse.json({ success: false, error: "Confirmed consent and its source are required to resubscribe." }, { status: 400 });
  }
  let preference;
  try {
    preference = await updateAdminMarketingPreference(session, {
      clientId: input.clientId, action: input.action as "unsubscribe" | "resubscribe",
      reason: input.reason, consentSource: input.consentSource, confirmation: input.confirmation,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Your administrator access changed. Sign in again." }, { status: 403 });
    if (code === "CONSENT_CLIENT_NOT_FOUND") return NextResponse.json({ success: false, error: "Client not found." }, { status: 404 });
    if (code === "CONSENT_COMPANY_MIGRATION_REQUIRED") return NextResponse.json({ success: false, error: "Preference changes are unavailable until company-specific consent is configured." }, { status: 409 });
    if (code === "CONSENT_SAFETY_BLOCK" || code === "CONSENT_PROTECTED_BLOCK") return NextResponse.json({ success: false, error: "This address has a protected opt-out or safety block that cannot be lifted here." }, { status: 409 });
    return NextResponse.json({ success: false, error: "The preference change could not be saved." }, { status: 500 });
  }
  revalidatePath("/admin/clients");
  return NextResponse.json({ success: true, status: preference.status });
}
