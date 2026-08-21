import "server-only";

import { decryptGoogleSecret } from "@/lib/google-business-crypto";
import { prisma } from "@/lib/prisma";

export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

type TokenResponse = { access_token?: string; refresh_token?: string };
type GoogleAccount = { name?: string; accountName?: string };
type GoogleLocation = { name?: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string } };
type GoogleReview = { reviewId?: string; reviewer?: { displayName?: string; profilePhotoUrl?: string }; starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE"; comment?: string; createTime?: string; updateTime?: string; reviewReply?: { comment?: string; updateTime?: string } };
export type GoogleLocationOption = { accountResourceName: string; accountDisplayName: string; locationResourceName: string; locationTitle: string; locationAddress: string | null };

const ratings = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as const;

export function googleOAuthConfiguration() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim();
  const encryptionKey = process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY?.trim();
  return { configured: Boolean(clientId && clientSecret && encryptionKey), clientId, clientSecret };
}

export function googleRedirectUri(origin?: string) {
  const resolvedOrigin = origin || process.env.NEXT_PUBLIC_SITE_URL || "https://www.heliosrealestatemedia.com";
  return `${resolvedOrigin.replace(/\/+$/, "")}/api/admin/integrations/google-business/callback`;
}

export async function exchangeAuthorizationCode(code: string, verifier: string, redirectUri: string) {
  const config = googleOAuthConfiguration();
  if (!config.clientId || !config.clientSecret) throw new Error("Google OAuth credentials are not configured.");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier }), cache: "no-store" });
  const data = await response.json() as TokenResponse;
  if (!response.ok || !data.access_token || !data.refresh_token) throw new Error("Google did not return durable authorization. Reconnect and approve offline access.");
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function refreshAccessToken(refreshTokenCiphertext: string) {
  const config = googleOAuthConfiguration();
  if (!config.clientId || !config.clientSecret) throw new Error("Google OAuth credentials are not configured.");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: decryptGoogleSecret(refreshTokenCiphertext), grant_type: "refresh_token" }), cache: "no-store" });
  const data = await response.json() as TokenResponse;
  if (!response.ok || !data.access_token) throw new Error(response.status === 400 ? "Google access has expired or been revoked. Reconnect the account." : "Google authorization is temporarily unavailable.");
  return data.access_token;
}

async function googleJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 403 ? "Google denied access to the requested Business Profile." : `Google Business Profile request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function addressLabel(address: GoogleLocation["storefrontAddress"]) {
  if (!address) return null;
  return [...(address.addressLines ?? []), address.locality, address.administrativeArea, address.postalCode].filter(Boolean).join(", ") || null;
}

export async function discoverGoogleLocations(token: string): Promise<GoogleLocationOption[]> {
  const accounts = await googleJson<{ accounts?: GoogleAccount[] }>("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", token);
  const options: GoogleLocationOption[] = [];
  for (const account of accounts.accounts ?? []) {
    if (!account.name) continue;
    let pageToken: string | undefined;
    do {
      const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`);
      url.searchParams.set("readMask", "name,title,storeCode,websiteUri,storefrontAddress");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await googleJson<{ locations?: GoogleLocation[]; nextPageToken?: string }>(url.toString(), token);
      for (const location of page.locations ?? []) if (location.name) options.push({ accountResourceName: account.name, accountDisplayName: account.accountName || account.name, locationResourceName: location.name, locationTitle: location.title || location.name, locationAddress: addressLabel(location.storefrontAddress) });
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  return options;
}

export async function discoverLocationsForConnection(workspaceId: string) {
  const connection = await prisma.googleBusinessConnection.findUnique({ where: { workspaceId } });
  if (!connection) throw new Error("Google Business Profile is not connected.");
  return discoverGoogleLocations(await refreshAccessToken(connection.refreshTokenCiphertext));
}

export async function syncGoogleBusinessReviews(workspaceId: string) {
  const connection = await prisma.googleBusinessConnection.findUnique({ where: { workspaceId } });
  if (!connection || connection.status !== "CONNECTED" || !connection.accountResourceName || !connection.locationResourceName) throw new Error("Select a Google Business Profile location before syncing reviews.");
  const token = await refreshAccessToken(connection.refreshTokenCiphertext);
  const accountId = connection.accountResourceName.replace(/^accounts\//, "");
  const locationId = connection.locationResourceName.replace(/^locations\//, "");
  const reviews: GoogleReview[] = [];
  try {
    let pageToken: string | undefined;
    do {
      const url = new URL(`https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews`);
      url.searchParams.set("pageSize", "50"); url.searchParams.set("orderBy", "updateTime desc"); if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await googleJson<{ reviews?: GoogleReview[]; nextPageToken?: string }>(url.toString(), token);
      reviews.push(...(page.reviews ?? [])); pageToken = page.nextPageToken;
    } while (pageToken);

    const syncedAt = new Date(); let imported = 0; let updated = 0;
    for (const review of reviews) {
      if (!review.reviewId) continue;
      const key = { connectionId: connection.id, googleReviewId: review.reviewId };
      const existing = await prisma.googleBusinessReview.findUnique({ where: { connectionId_googleReviewId: key }, select: { id: true } });
      const data = { reviewerName: review.reviewer?.displayName?.trim() || "Google reviewer", reviewerPhotoUrl: review.reviewer?.profilePhotoUrl || null, starRating: review.starRating ? ratings[review.starRating] : 5, reviewText: review.comment?.trim() || null, reviewCreatedAt: review.createTime ? new Date(review.createTime) : null, reviewUpdatedAt: review.updateTime ? new Date(review.updateTime) : null, businessReplyText: review.reviewReply?.comment?.trim() || null, businessReplyUpdatedAt: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null, lastSyncedAt: syncedAt, syncStatus: "CURRENT" as const, syncError: null };
      await prisma.googleBusinessReview.upsert({ where: { connectionId_googleReviewId: key }, create: { workspaceId, ...key, ...data }, update: data });
      if (existing) updated += 1;
      else imported += 1;
    }
    await prisma.googleBusinessConnection.update({ where: { id: connection.id }, data: { lastSyncAt: syncedAt, lastSyncStatus: "CURRENT", lastSyncError: null, status: "CONNECTED" } });
    return { received: reviews.length, imported, updated };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Google review synchronization failed.";
    await prisma.googleBusinessConnection.update({ where: { id: connection.id }, data: { lastSyncStatus: "ERROR", lastSyncError: message, status: "ERROR" } });
    throw error;
  }
}
