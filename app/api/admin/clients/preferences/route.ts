import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { setMarketingPreference } from "@/lib/client-communications/preferences";
import { recordAuditEvent } from "@/lib/audit";

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
  if (!input.clientId || !["unsubscribe", "resubscribe"].includes(input.action ?? "")) {
    return NextResponse.json({ success: false, error: "A client and preference action are required." }, { status: 400 });
  }
  if (input.action === "resubscribe" && (!input.confirmation || !input.consentSource?.trim())) {
    return NextResponse.json({ success: false, error: "Confirmed consent and its source are required to resubscribe." }, { status: 400 });
  }
  const client = await prisma.communicationClient.findUnique({
    where: { id: input.clientId },
    select: { id: true, displayName: true, email: true },
  });
  if (!client) return NextResponse.json({ success: false, error: "Client not found." }, { status: 404 });
  const resubscribing = input.action === "resubscribe";
  const preference = await setMarketingPreference({
    email: client.email,
    status: resubscribing ? "SUBSCRIBED" : "UNSUBSCRIBED",
    source: resubscribing ? "ADMIN_CONFIRMED_CONSENT" : "ADMIN_UNSUBSCRIBE",
    reason: input.reason?.trim().slice(0, 500) || null,
    actorId: session.userId,
    resubscribeMethod: resubscribing ? input.consentSource!.trim().slice(0, 200) : null,
  });
  await recordAuditEvent({
    actorId: session.userId,
    actorEmail: session.email,
    action: resubscribing ? "MARKETING_EMAIL_RESUBSCRIBED" : "MARKETING_EMAIL_UNSUBSCRIBED",
    entityType: "CommunicationClient",
    entityId: client.id,
    summary: `${client.displayName} was ${resubscribing ? "resubscribed with recorded consent" : "unsubscribed"} from marketing email.`,
    metadata: { normalizedEmail: preference.normalizedEmail, consentSource: resubscribing ? input.consentSource : undefined },
  });
  revalidatePath("/admin/clients");
  return NextResponse.json({ success: true, status: preference.status });
}
