import { timingSafeEqual } from "node:crypto";

export type ReferralCronAuthResult =
  | { authenticated: true; reason: null }
  | { authenticated: false; reason: "SECRET_MISSING" | "AUTHORIZATION_MISSING" | "BEARER_MISMATCH" };

export function authenticateReferralCron(
  authorizationHeader: string | null,
  configuredSecret: string | undefined,
): ReferralCronAuthResult {
  if (!configuredSecret) return { authenticated: false, reason: "SECRET_MISSING" };
  if (!authorizationHeader) return { authenticated: false, reason: "AUTHORIZATION_MISSING" };

  const match = authorizationHeader.match(/^Bearer ([^\r\n]+)$/i);
  const provided = match?.[1] ?? "";
  const expectedBytes = Buffer.from(configuredSecret);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length) {
    return { authenticated: false, reason: "BEARER_MISMATCH" };
  }

  return timingSafeEqual(expectedBytes, providedBytes)
    ? { authenticated: true, reason: null }
    : { authenticated: false, reason: "BEARER_MISMATCH" };
}
