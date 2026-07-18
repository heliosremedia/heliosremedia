import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

function requestContext(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ipAddress: forwarded || request.headers.get("x-real-ip"), userAgent: request.headers.get("user-agent") };
}

function normalizeEnvironmentValue(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  const startsWithQuote = normalized.startsWith('"') || normalized.startsWith("'");
  const endsWithQuote = normalized.endsWith('"') || normalized.endsWith("'");

  return startsWithQuote && endsWithQuote
    ? normalized.slice(1, -1).trim()
    : normalized;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const ownerEmail = normalizeEnvironmentValue(process.env.HELIOS_ADMIN_EMAIL)?.toLowerCase();
    const passwordHash = normalizeEnvironmentValue(process.env.HELIOS_ADMIN_PASSWORD_HASH);
    if (!ownerEmail || !passwordHash) return NextResponse.json({ success: false, error: "Admin authentication has not been configured." }, { status: 503 });

    const user = await prisma.adminUser.upsert({ where: { email: ownerEmail }, create: { email: ownerEmail, displayName: process.env.HELIOS_ADMIN_NAME?.trim() || "Helios Owner", role: "OWNER" }, update: {} });
    const context = requestContext(request);
    if (!user.active) return NextResponse.json({ success: false, error: "This account is disabled." }, { status: 403 });
    if (user.lockedUntil && user.lockedUntil > new Date()) return NextResponse.json({ success: false, error: "Too many attempts. Try again later." }, { status: 429 });

    const valid = email === ownerEmail && await verifyPassword(password, passwordHash);
    if (!valid) {
      const failures = user.failedLoginCount + 1;
      const lockedUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await prisma.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: lockedUntil ? 0 : failures, lockedUntil } });
      await recordAuditEvent({ actorId: user.id, actorEmail: email || null, action: "AUTH_LOGIN_FAILED", entityType: "AdminUser", entityId: user.id, summary: lockedUntil ? "Admin account temporarily locked after repeated failed sign-ins." : "Failed admin sign-in attempt.", ...context });
      return NextResponse.json({ success: false, error: "The email or password is incorrect." }, { status: 401 });
    }

    await prisma.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await recordAuditEvent({ actorId: user.id, actorEmail: user.email, action: "AUTH_LOGIN_SUCCEEDED", entityType: "AdminUser", entityId: user.id, summary: "Admin signed in.", ...context });
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken({ userId: user.id, email: user.email, displayName: user.displayName, role: user.role }), sessionCookieOptions);
    return response;
  } catch (error) {
    console.error("Unable to sign in:", error);
    return NextResponse.json({ success: false, error: "Sign-in is temporarily unavailable." }, { status: 500 });
  }
}
