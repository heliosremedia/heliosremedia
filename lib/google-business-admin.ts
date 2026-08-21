import "server-only";

import type { AdminSession } from "@/lib/auth/session";
import { googleOAuthConfiguration } from "@/lib/google-business-reviews";
import { prisma } from "@/lib/prisma";

export function canManageGoogleBusiness(session: AdminSession) { return session.role === "OWNER" || session.role === "ADMIN"; }

export async function getGoogleBusinessAdminState(session: AdminSession & { workspaceId: string }) {
  const base = { oauthConfigured: googleOAuthConfiguration().configured, authorized: canManageGoogleBusiness(session), databaseReady: true };
  try {
    const [connection, reviews] = await Promise.all([
      prisma.googleBusinessConnection.findUnique({ where: { workspaceId: session.workspaceId }, select: { status: true, accountDisplayName: true, locationResourceName: true, locationTitle: true, locationAddress: true, availableLocations: true, lastSyncAt: true, lastSyncStatus: true, lastSyncError: true, connectedAt: true } }),
      prisma.googleBusinessReview.findMany({ where: { workspaceId: session.workspaceId }, orderBy: [{ reviewUpdatedAt: "desc" }, { createdAt: "desc" }], take: 50, select: { id: true, googleReviewId: true, reviewerName: true, reviewerPhotoUrl: true, starRating: true, reviewText: true, reviewCreatedAt: true, reviewUpdatedAt: true, businessReplyText: true, lastSyncedAt: true, syncStatus: true, testimonialId: true } }),
    ]);
    return { ...base, connection, reviews };
  } catch (error) {
    if (error instanceof Error && /GoogleBusiness(Connection|Review)|does not exist/i.test(error.message)) return { ...base, databaseReady: false, connection: null, reviews: [] };
    throw error;
  }
}
