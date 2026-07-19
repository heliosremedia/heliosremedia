import type { ClientPortal } from "@/app/generated/prisma/client";

export function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new Error("INVALID_EMAIL");
  return email;
}

export function cleanText(value: unknown, max: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > max) throw new Error("INVALID_TEXT");
  return result || null;
}

export function cleanUrl(value: unknown) {
  const result = cleanText(value, 1000);
  if (!result) return null;
  const candidate = /^https?:\/\//i.test(result) ? result : `https://${result}`;
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("INVALID_URL");
  return parsed.toString();
}

export function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function portalDestination(portal: Pick<ClientPortal, "provider" | "loginUrl" | "registrationUrl">, purpose: "LOGIN" | "REGISTER") {
  return purpose === "LOGIN" ? portal.loginUrl : portal.registrationUrl;
}

export function safeSsoUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("INVALID_SSO_URL");
  return parsed.toString();
}
