import { getAdminSession } from "@/lib/auth/session";
import { serveStudioTeamPortalSample } from "@/lib/team-portal-owner-sample";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ asset?: string[] }> };

async function readSample(request: Request, context: Context) {
  const { asset = [] } = await context.params;
  return serveStudioTeamPortalSample(request, asset, getAdminSession, process.env.HELIOS_ADMIN_EMAIL);
}

export { readSample as GET, readSample as HEAD };
