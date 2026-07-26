import { createHash, randomBytes } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERRAL_TEST_TOKEN_TTL_HOURS = 48;

export function hashReferralToken(token: string) {
  return createHash("sha256").update(`helios:referral-link:v1:${token}`).digest("hex");
}

export function createReferralCredentials() {
  const token = randomBytes(32).toString("base64url");
  const entropy = randomBytes(8);
  let code = "HEL-";
  for (const byte of entropy) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return { token, tokenHash: hashReferralToken(token), code };
}

export function createReferralTestCredentials() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashReferralToken(`test:${token}`) };
}

export function hashReferralTestToken(token: string) {
  return hashReferralToken(`test:${token}`);
}

export function referralPublicPath(token: string) {
  return `/refer/${encodeURIComponent(token)}`;
}
