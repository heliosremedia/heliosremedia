import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createPortalToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function portalRequestFingerprint(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  return createHmac("sha256", secret()).update(address).digest("hex");
}

export const PORTAL_REGISTRATION_COOKIE = "helios_portal_registration";

type RegistrationSession = {
  challengeId: string;
  portalId: string;
  email: string;
  expiresAt: number;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createRegistrationSession(input: Omit<RegistrationSession, "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({ ...input, expiresAt: Date.now() + 15 * 60 * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyRegistrationSession(token: string | undefined): RegistrationSession | null {
  try {
    if (!token) return null;
    const [payload, supplied] = token.split(".");
    if (!payload || !supplied) return null;
    const expected = signature(payload);
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RegistrationSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}
