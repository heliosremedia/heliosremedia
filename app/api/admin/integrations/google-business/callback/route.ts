import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { canManageGoogleBusiness } from "@/lib/google-business-admin";
import { decryptGoogleSecret, encryptGoogleSecret, hashOAuthState } from "@/lib/google-business-crypto";
import { discoverGoogleLocations, exchangeAuthorizationCode, googleRedirectUri } from "@/lib/google-business-reviews";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function adminRedirect(request: Request, result: string) { return NextResponse.redirect(new URL(`/admin/testimonials?google=${encodeURIComponent(result)}`, request.url)); }

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || !canManageGoogleBusiness(session)) return adminRedirect(request, "unauthorized");
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  if (!state) return adminRedirect(request, "invalid_state");
  const saved = await prisma.googleBusinessOAuthState.findUnique({ where: { stateHash: hashOAuthState(state) } });
  if (!saved || saved.consumedAt || saved.expiresAt <= new Date() || saved.workspaceId !== session.workspaceId || saved.adminUserId !== session.userId) return adminRedirect(request, "invalid_state");
  await prisma.googleBusinessOAuthState.update({ where: { id: saved.id }, data: { consumedAt: new Date() } });
  if (url.searchParams.get("error")) return adminRedirect(request, "denied");
  const code = url.searchParams.get("code");
  if (!code) return adminRedirect(request, "missing_code");

  try {
    const tokens = await exchangeAuthorizationCode(code, decryptGoogleSecret(saved.codeVerifierCiphertext), googleRedirectUri(process.env.GOOGLE_BUSINESS_REDIRECT_ORIGIN));
    const locations = await discoverGoogleLocations(tokens.accessToken);
    const selected = locations.length === 1 ? locations[0] : null;
    await prisma.googleBusinessConnection.upsert({
      where: { workspaceId: session.workspaceId },
      create: { workspaceId: session.workspaceId, refreshTokenCiphertext: encryptGoogleSecret(tokens.refreshToken), status: selected ? "CONNECTED" : locations.length ? "NEEDS_LOCATION" : "ERROR", accountResourceName: selected?.accountResourceName, accountDisplayName: selected?.accountDisplayName, locationResourceName: selected?.locationResourceName, locationTitle: selected?.locationTitle, locationAddress: selected?.locationAddress, availableLocations: locations, connectedAt: selected ? new Date() : null, connectedById: session.userId, lastSyncError: locations.length ? null : "No manageable Google Business Profile locations were found." },
      update: { refreshTokenCiphertext: encryptGoogleSecret(tokens.refreshToken), status: selected ? "CONNECTED" : locations.length ? "NEEDS_LOCATION" : "ERROR", accountResourceName: selected?.accountResourceName ?? null, accountDisplayName: selected?.accountDisplayName ?? null, locationResourceName: selected?.locationResourceName ?? null, locationTitle: selected?.locationTitle ?? null, locationAddress: selected?.locationAddress ?? null, availableLocations: locations, connectedAt: selected ? new Date() : null, disconnectedAt: null, connectedById: session.userId, lastSyncError: locations.length ? null : "No manageable Google Business Profile locations were found." },
    });
    await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "GOOGLE_BUSINESS_AUTHORIZED", entityType: "GoogleBusinessConnection", summary: selected ? "Google Business Profile connected." : "Google authorization completed; location selection is required." });
    return adminRedirect(request, selected ? "connected" : locations.length ? "choose_location" : "no_locations");
  } catch {
    return adminRedirect(request, "connection_failed");
  }
}
