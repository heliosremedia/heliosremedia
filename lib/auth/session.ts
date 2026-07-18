import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export { createSessionToken, SESSION_COOKIE, type AdminSession } from "./token";
import { SESSION_COOKIE, SESSION_LIFETIME_SECONDS, verifySessionToken } from "./token";

export async function getAdminSession() { return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value); }
export async function requireAdminSession() { const session = await getAdminSession(); if (!session) redirect("/login"); return session; }
export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_LIFETIME_SECONDS };
