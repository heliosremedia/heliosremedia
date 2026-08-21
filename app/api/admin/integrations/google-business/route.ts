import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { canManageGoogleBusiness } from "@/lib/google-business-admin";
import { decryptGoogleSecret } from "@/lib/google-business-crypto";
import { discoverLocationsForConnection } from "@/lib/google-business-reviews";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

async function authorized() {
  const session = await getAdminSession();
  return session && canManageGoogleBusiness(session) ? session : null;
}

export async function PATCH(request: Request) {
  const session = await authorized();
  if (!session) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  try {
    const body = await request.json() as { locationResourceName?: string };
    const locations = await discoverLocationsForConnection(session.workspaceId);
    const selected = locations.find((location) => location.locationResourceName === body.locationResourceName);
    if (!selected) return NextResponse.json({ success: false, error: "Select a location returned by the connected Google account." }, { status: 400 });
    await prisma.googleBusinessConnection.update({ where: { workspaceId: session.workspaceId }, data: { ...selected, availableLocations: locations, status: "CONNECTED", connectedAt: new Date(), disconnectedAt: null, lastSyncError: null } });
    await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_BUSINESS_LOCATION_SELECTED", entityType: "GoogleBusinessConnection", summary: `Google Business Profile location selected: ${selected.locationTitle}.` });
    revalidatePath("/admin/testimonials");
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The Google location could not be saved." }, { status: 502 }); }
}

export async function DELETE() {
  const session = await authorized();
  if (!session) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const connection = await prisma.googleBusinessConnection.findUnique({ where: { workspaceId: session.workspaceId } });
  if (!connection) return NextResponse.json({ success: true });
  try {
    const refreshToken = decryptGoogleSecret(connection.refreshTokenCiphertext);
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }), cache: "no-store" });
  } catch { /* Local disconnection still removes stored credentials if Google is unavailable. */ }
  await prisma.googleBusinessConnection.delete({ where: { id: connection.id } });
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_BUSINESS_DISCONNECTED", entityType: "GoogleBusinessConnection", summary: "Google Business Profile access disconnected and stored credentials removed." });
  revalidatePath("/admin/testimonials");
  return NextResponse.json({ success: true });
}
