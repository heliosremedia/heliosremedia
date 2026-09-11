import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export { createSessionToken, SESSION_COOKIE, type AdminSession } from "./token";
import { SESSION_COOKIE, SESSION_LIFETIME_SECONDS, verifySessionToken } from "./token";
import { getWorkspaceAccess } from "@/lib/workspace-memberships";
import { prisma } from "@/lib/prisma";

export async function getAdminSession() {
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.adminUser.findUnique({ where: { id: session.userId }, select: { id: true, active: true, sessionVersion: true, role: true, email: true, displayName: true, navigationFavorites: true, workspaceId: true } });
  if (!user?.active || user.sessionVersion !== session.sessionVersion) return null;
  const access = await getWorkspaceAccess(user);
  if (!access) return null;
  const navigationFavorites = Array.isArray(user.navigationFavorites)
    ? user.navigationFavorites.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return { ...session, role: access.role, email: user.email, displayName: user.displayName, navigationFavorites, workspaceId: access.workspaceId };
}
export async function requireAdminSession() { const session = await getAdminSession(); if (!session) redirect("/login"); return session; }
export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_LIFETIME_SECONDS };
