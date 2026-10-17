import { getAdminSession } from "@/lib/auth/session";
import { readSupportDiagnostics, supportEnabled } from "@/lib/platform-support/access";
import { supportFailure, supportResponse } from "@/lib/platform-support/http";
export async function GET(request: Request) {
  if (!supportEnabled()) return supportResponse({ success: false }, 404);
  try {
    const session = await getAdminSession();
    if (!session) return supportResponse({ success: false }, 403);
    const diagnostics = await readSupportDiagnostics(session, new URL(request.url).searchParams.get("grantId"));
    return supportResponse({ success: true, diagnostics });
  } catch (error) { return supportFailure(error); }
}
