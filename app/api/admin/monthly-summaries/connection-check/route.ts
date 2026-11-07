import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { checkExistingConnection, VerificationError } from "@/lib/monthly-summaries/v1-check";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getAdminSession();
  if (!session || session.role !== "OWNER") return NextResponse.json({ error: "Owner access is required." }, { status: 403, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  try {
    const input = await request.json();
    if (typeof input.clientName !== "string" || typeof input.month !== "string" || typeof input.expectedTotalCents !== "number") return NextResponse.json({ error: "Enter the client, month, and expected purchase total." }, { status: 400, headers });
    const result = await checkExistingConnection({ apiKey: process.env.HDPH_API_KEY || "", clientName: input.clientName, month: input.month, expectedTotalCents: input.expectedTotalCents, authorizeClient: async clientId => Boolean(await prisma.communicationClient.findFirst({
      where: { hdPhotoHubUserId: clientId, workspaceMemberships: { some: { workspaceId: session.workspaceId } } }, select: { id: true },
    })) });
    return NextResponse.json(result, { headers });
  } catch (error) {
    // Never return upstream response bodies, credentials, or account records on errors.
    const message = error instanceof VerificationError ? error.message : "[request] The verification request could not be processed.";
    console.warn("Monthly summary verification failed:", message);
    return NextResponse.json({ error: `${message} No records were changed or emails sent.` }, { status: 502, headers });
  }
}
