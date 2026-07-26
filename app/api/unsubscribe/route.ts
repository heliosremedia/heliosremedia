import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumePreferenceToken, setMarketingPreference } from "@/lib/client-communications/preferences";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await request.json() as { token?: string; reason?: string }
      : Object.fromEntries(await request.formData()) as { token?: string; reason?: string };
    const queryToken = new URL(request.url).searchParams.get("token");
    const token = await consumePreferenceToken(typeof body.token === "string" ? body.token : queryToken ?? "");
    if (!token) return NextResponse.json({ success: false, error: "This preference link is invalid or expired." }, { status: 400 });
    await setMarketingPreference({
      email: token.preference.normalizedEmail,
      status: "UNSUBSCRIBED",
      source: "PUBLIC_UNSUBSCRIBE",
      reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null,
      campaignId: token.campaignId,
      messageId: token.messageId,
    });
    await prisma.marketingEmailPreferenceToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "This unsubscribe request could not be completed." }, { status: 400 });
  }
}
