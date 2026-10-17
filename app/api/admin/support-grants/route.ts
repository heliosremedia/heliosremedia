import { getAdminSession } from "@/lib/auth/session";
import { createSupportGrant, revokeSupportGrant, supportEnabled } from "@/lib/platform-support/access";
import { supportFailure, supportResponse } from "@/lib/platform-support/http";
async function mutate(request: Request, revoke: boolean) {
  if (!supportEnabled()) return supportResponse({ success: false }, 404);
  try {
    const session = await getAdminSession();
    if (!session) return supportResponse({ success: false }, 403);
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return supportResponse({ success: false }, 400);
    const result = await (revoke ? revokeSupportGrant(session, body) : createSupportGrant(session, body));
    return supportResponse({ success: true, ...(revoke ? result : { grant: result }) }, revoke ? 200 : 201);
  } catch (error) { return supportFailure(error); }
}
export async function POST(request: Request) { return mutate(request, false); }
export async function DELETE(request: Request) { return mutate(request, true); }
