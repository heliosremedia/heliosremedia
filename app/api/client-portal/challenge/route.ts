import { NextResponse } from "next/server";

import { sendPortalVerificationEmail } from "@/lib/client-portal/email";
import { getHdPhotoHubUser, userBelongsToGroup } from "@/lib/client-portal/hdphotohub";
import { createPortalToken, hashPortalToken, portalRequestFingerprint } from "@/lib/client-portal/tokens";
import { normalizeEmail, portalDestination } from "@/lib/client-portal/validation";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const email = normalizeEmail(body.email);
    const portal = await prisma.clientPortal.findFirst({ where: { slug, active: true } });
    if (!portal) return NextResponse.json({ success: false, error: "This client portal is not available." }, { status: 404 });

    if (portal.provider === "EXTERNAL") {
      const destination = portalDestination(portal, "LOGIN");
      if (!destination) return NextResponse.json({ success: false, error: "This external login has not been configured." }, { status: 503 });
      return NextResponse.json({ success: true, redirectUrl: destination });
    }

    const requestFingerprint = portalRequestFingerprint(request);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent, recentFromAddress] = await Promise.all([
      prisma.clientPortalChallenge.count({ where: { portalId: portal.id, email, createdAt: { gte: oneHourAgo } } }),
      prisma.clientPortalChallenge.count({ where: { requestFingerprint, createdAt: { gte: oneHourAgo } } }),
    ]);
    if (recent >= 5) return NextResponse.json({ success: false, error: "Too many access requests were made. Please wait before trying again." }, { status: 429 });
    if (recentFromAddress >= 20) return NextResponse.json({ success: false, error: "Too many access requests were made. Please wait before trying again." }, { status: 429 });

    const user = await getHdPhotoHubUser(email);
    if (user && !userBelongsToGroup(user, portal.hdphGroupId)) {
      return NextResponse.json({ success: true, message: "If this email is eligible, a secure access link is on its way." });
    }
    if (!user && !portal.registrationEnabled) {
      return NextResponse.json({ success: true, message: "If this email is eligible, a secure access link is on its way." });
    }

    const purpose = user ? "LOGIN" as const : "REGISTER" as const;
    const token = createPortalToken();
    const challenge = await prisma.clientPortalChallenge.create({ data: { portalId: portal.id, purpose, email, tokenHash: hashPortalToken(token), requestFingerprint, expiresAt: new Date(Date.now() + 15 * 60 * 1000) }, select: { id: true } });
    const settings = await getSiteSettings();
    const verificationUrl = new URL("/api/client-portal/verify", request.url);
    verificationUrl.searchParams.set("token", token);
    try {
      await sendPortalVerificationEmail({ email, businessName: settings.businessName, portalName: portal.name, verificationUrl: verificationUrl.toString(), purpose });
    } catch (error) {
      await prisma.clientPortalChallenge.delete({ where: { id: challenge.id } });
      throw error;
    }
    return NextResponse.json({ success: true, message: "If this email is eligible, a secure access link is on its way." });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_EMAIL") return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    console.error("Unable to start client portal access:", error);
    const message = error instanceof Error && (error.message.includes("email delivery") || error.message.includes("verification email"))
      ? error.message
      : "Secure client access could not be started. Please try again.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
