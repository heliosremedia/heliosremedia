import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdminRole } from "@/app/generated/prisma/client";

export const SESSION_COOKIE = "helios_admin_session";
export const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;
export type AdminSession = { userId: string; email: string; displayName: string; role: AdminRole; sessionVersion: number; expiresAt: number };

function secret() { const value = process.env.AUTH_SECRET; if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters."); return value; }
function signature(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export function createSessionToken(session: Omit<AdminSession, "expiresAt">) { const payload = Buffer.from(JSON.stringify({ ...session, expiresAt: Date.now() + SESSION_LIFETIME_SECONDS * 1000 })).toString("base64url"); return `${payload}.${signature(payload)}`; }
export function verifySessionToken(token: string | undefined): AdminSession | null { try { if (!token) return null; const [payload, supplied] = token.split("."); if (!payload || !supplied) return null; const expected = signature(payload); const a = Buffer.from(supplied); const b = Buffer.from(expected); if (a.length !== b.length || !timingSafeEqual(a, b)) return null; const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession; return session.expiresAt > Date.now() ? session : null; } catch { return null; } }
