import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (session) await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "AUTH_LOGOUT", entityType: "AdminUser", entityId: session.userId, summary: "Admin signed out.", ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request.headers.get("user-agent") });
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
