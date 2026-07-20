import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getHdPhotoHubSso, getHdPhotoHubUser, userBelongsToGroup } from "@/lib/client-portal/hdphotohub";
import { createRegistrationSession, hashPortalToken, PORTAL_REGISTRATION_COOKIE } from "@/lib/client-portal/tokens";
import { safeSsoUrl } from "@/lib/client-portal/validation";
import { prisma } from "@/lib/prisma";

function portalError(request: Request, slug: string, message: string) {
  const url = new URL(`/client-portal/${slug}`, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const challenge = await prisma.clientPortalChallenge.findUnique({ where: { tokenHash: hashPortalToken(token) }, include: { portal: true } });
  if (!challenge) return NextResponse.redirect(new URL("/client-portal?error=This+access+link+is+invalid.", request.url));
  if (!challenge.portal.active || challenge.portal.provider !== "HDPHOTOHUB") return portalError(request, challenge.portal.slug, "This client portal is no longer available.");
  if (challenge.consumedAt || challenge.expiresAt <= new Date()) return portalError(request, challenge.portal.slug, "This access link has expired. Request a new one.");

  try {
    if (challenge.purpose === "LOGIN") {
      const user = await getHdPhotoHubUser(challenge.email);
      if (!user || !userBelongsToGroup(user, challenge.portal.hdphGroupId)) return portalError(request, challenge.portal.slug, "The account could not be opened from this portal.");
      const sso = await getHdPhotoHubSso(challenge.email);
      const consumed = await prisma.clientPortalChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (!consumed.count) return portalError(request, challenge.portal.slug, "This access link has already been used.");
      return NextResponse.redirect(safeSsoUrl(sso.url));
    }

    const consumed = await prisma.clientPortalChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    if (!consumed.count) return portalError(request, challenge.portal.slug, "This access link has already been used.");
    const session = createRegistrationSession({ challengeId: challenge.id, portalId: challenge.portalId, email: challenge.email });
    (await cookies()).set(PORTAL_REGISTRATION_COOKIE, session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60 });
    return NextResponse.redirect(new URL(`/client-portal/${challenge.portal.slug}/complete-registration`, request.url));
  } catch (error) {
    console.error("Unable to verify client portal challenge:", error);
    return portalError(request, challenge.portal.slug, "Client access could not be completed. Please try again.");
  }
}
