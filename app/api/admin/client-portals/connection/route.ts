import { canUseLegacyPortalProvider } from "@/lib/client-portal/ownership";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { getHdPhotoHubBrand, getHdPhotoHubGroups, isHdPhotoHubConfigured } from "@/lib/client-portal/hdphotohub";

export async function GET() {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  if (!await canUseLegacyPortalProvider(session.workspaceId)) return NextResponse.json({ success: false, configured: false, error: "Client access is not configured for this company." }, { status: 503 });
  if (!isHdPhotoHubConfigured()) return NextResponse.json({ success: false, configured: false, error: "Add HDPH_API_KEY to the deployment environment first." }, { status: 503 });

  try {
    const [brand, groups] = await Promise.all([getHdPhotoHubBrand(), getHdPhotoHubGroups()]);
    return NextResponse.json({ success: true, configured: true, emailConfigured: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.PORTAL_EMAIL_FROM?.trim()), brand, groups: groups.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (error) {
    console.error("Unable to connect to HDPhotoHub:", error);
    return NextResponse.json({ success: false, configured: true, error: "HDPhotoHub could not be reached with the configured API key." }, { status: 502 });
  }
}
