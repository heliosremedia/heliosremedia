import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { checkExistingConnection } from "@/lib/monthly-summaries/v1-check";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getAdminSession();
  if (!session || session.role !== "OWNER") return NextResponse.json({ error: "Owner access is required." }, { status: 403, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  try {
    const result = await checkExistingConnection({ apiKey: process.env.HDPH_API_KEY || "", authorizeClient: async clientId => Boolean(await prisma.communicationClient.findFirst({
      where: { hdPhotoHubUserId: clientId, workspaceMemberships: { some: { workspaceId: session.workspaceId } } }, select: { id: true },
    })) });
    return NextResponse.json(result, { headers });
  } catch {
    // Never return upstream response bodies, credentials, or account records on errors.
    return NextResponse.json({ error: "The read-only check could not finish. Verify the existing key, client-directory association, and API response fields. No records were changed or emails sent." }, { status: 502, headers });
  }
}
