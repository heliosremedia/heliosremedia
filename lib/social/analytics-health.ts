import 'server-only';
import type { Prisma } from '@/app/generated/prisma/client';

type Observation = {
  connectionId: string;
  workspaceId: string;
  attemptedAt: Date;
} & ({ succeeded: true } | { succeeded: false; category: string; message: string });

/** Call only inside commitAnalyticsClaim, after verifying and locking the claim. */
export async function recordAnalyticsHealth(tx: Prisma.TransactionClient, observation: Observation) {
  const { connectionId, workspaceId, attemptedAt, succeeded } = observation;
  const state = succeeded ? 'AVAILABLE' : observation.category === 'PERMISSION' ? 'PERMISSION_REQUIRED'
    : observation.category === 'AUTHENTICATION' ? 'CONNECTION_REQUIRED' : 'REFRESH_FAILED';
  const message = succeeded ? null : observation.message;
  // An older observation still settles its own job but cannot replace newer
  // connection health. Equal timestamps retain the first committed observation.
  await tx.$executeRaw`
    UPDATE "SocialConnection"
    SET "analyticsPermissionState" = ${state}::"SocialMetricAvailability",
        "analyticsLastAttemptAt" = ${attemptedAt},
        "analyticsFailureCount" = CASE WHEN ${succeeded} THEN 0 ELSE "analyticsFailureCount" + 1 END,
        "analyticsError" = ${message}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${connectionId} AND "workspaceId" = ${workspaceId}
      AND ("analyticsLastAttemptAt" IS NULL OR "analyticsLastAttemptAt" < ${attemptedAt})
  `;
  // A late success remains useful evidence even when a newer failure controls
  // current health. Never regress or erase the latest successful attempt time.
  if (succeeded) await tx.$executeRaw`
    UPDATE "SocialConnection"
    SET "analyticsLastSuccessfulAt" = ${attemptedAt}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${connectionId} AND "workspaceId" = ${workspaceId}
      AND ("analyticsLastSuccessfulAt" IS NULL OR "analyticsLastSuccessfulAt" < ${attemptedAt})
  `;
}
