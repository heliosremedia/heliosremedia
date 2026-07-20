import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createHdPhotoHubClient, getHdPhotoHubBrand, getHdPhotoHubSso, getHdPhotoHubUser, setHdPhotoHubPassword, userBelongsToGroup } from "@/lib/client-portal/hdphotohub";
import { PORTAL_REGISTRATION_COOKIE, verifyRegistrationSession } from "@/lib/client-portal/tokens";
import { cleanText, safeSsoUrl } from "@/lib/client-portal/validation";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = verifyRegistrationSession(cookieStore.get(PORTAL_REGISTRATION_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Your registration session expired. Start again from the client portal." }, { status: 401 });
  try {
    const challenge = await prisma.clientPortalChallenge.findFirst({ where: { id: session.challengeId, portalId: session.portalId, email: session.email, purpose: "REGISTER", consumedAt: { not: null }, expiresAt: { gt: new Date() } }, select: { id: true } });
    if (!challenge) return NextResponse.json({ success: false, error: "Your registration session expired. Start again from the client portal." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const firstName = cleanText(body.firstName, 100, true)!;
    const lastName = cleanText(body.lastName, 100, true)!;
    const phone = cleanText(body.phone, 40);
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password)) return NextResponse.json({ success: false, error: "Use at least 10 characters with a letter and a number." }, { status: 400 });
    const portal = await prisma.clientPortal.findFirst({ where: { id: session.portalId, active: true, provider: "HDPHOTOHUB" } });
    if (!portal) return NextResponse.json({ success: false, error: "This client portal is no longer available." }, { status: 404 });
    const existing = await getHdPhotoHubUser(session.email);
    if (existing) {
      if (!userBelongsToGroup(existing, portal.hdphGroupId)) return NextResponse.json({ success: false, error: "This account is not eligible for this client portal." }, { status: 403 });
      const sso = await getHdPhotoHubSso(session.email);
      cookieStore.delete(PORTAL_REGISTRATION_COOKIE);
      return NextResponse.json({ success: true, redirectUrl: safeSsoUrl(sso.url) });
    }
    const brand = await getHdPhotoHubBrand();
    const user = await createHdPhotoHubClient({ brandId: brand.bid, groupId: portal.hdphGroupId, email: session.email, firstName, lastName, phone });
    await setHdPhotoHubPassword(user.uid, password);
    const sso = await getHdPhotoHubSso(session.email);
    cookieStore.delete(PORTAL_REGISTRATION_COOKIE);
    return NextResponse.json({ success: true, redirectUrl: safeSsoUrl(sso.url) });
  } catch (error) {
    console.error("Unable to create HDPhotoHub client:", error);
    return NextResponse.json({ success: false, error: "The client account could not be created. Please contact us for help." }, { status: 500 });
  }
}
