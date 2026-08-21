import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { canManageGoogleBusiness } from "@/lib/google-business-admin";
import { encryptGoogleSecret, hashOAuthState, pkceChallenge } from "@/lib/google-business-crypto";
import { GOOGLE_BUSINESS_SCOPE, googleOAuthConfiguration, googleRedirectUri } from "@/lib/google-business-reviews";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (!canManageGoogleBusiness(session)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const config = googleOAuthConfiguration();
  if (!config.configured || !config.clientId) return NextResponse.json({ success: false, error: "Google OAuth credentials have not been configured." }, { status: 503 });

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  await prisma.googleBusinessOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.googleBusinessOAuthState.create({ data: { stateHash: hashOAuthState(state), codeVerifierCiphertext: encryptGoogleSecret(verifier), workspaceId: session.workspaceId, adminUserId: session.userId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });

  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", config.clientId);
  authorization.searchParams.set("redirect_uri", googleRedirectUri(process.env.GOOGLE_BUSINESS_REDIRECT_ORIGIN));
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", GOOGLE_BUSINESS_SCOPE);
  authorization.searchParams.set("access_type", "offline");
  authorization.searchParams.set("prompt", "consent");
  authorization.searchParams.set("include_granted_scopes", "true");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("code_challenge", pkceChallenge(verifier));
  authorization.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(authorization);
}
