import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/client-communications/email";

export async function POST(request: Request) {
  try {
    const { token } = await request.json() as { token?: string };
    const clientId = verifyUnsubscribeToken(typeof token === "string" ? token : "");
    if (!clientId) return NextResponse.json({ success: false, error: "This unsubscribe link is invalid." }, { status: 400 });
    await prisma.communicationClient.update({
      where: { id: clientId },
      data: { emailSubscribed: false, unsubscribedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "This unsubscribe request could not be completed." }, { status: 400 });
  }
}
