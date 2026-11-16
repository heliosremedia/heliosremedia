import { DEFAULT_PUBLIC_SITE_URL } from "../site.ts";

// These public aliases redirect to the same canonical Helios site. Do not allow
// arbitrary external hosts, even when the API response otherwise looks valid.
const publicOrigins = new Set([
  DEFAULT_PUBLIC_SITE_URL,
  "https://heliosrealestatemedia.com",
  "https://www.heliosremedia.com",
  "https://heliosremedia.com",
]);
export function verifiedEventLink(value: unknown, path: "/events/invite" | "/events/rsvp", currentOrigin: string): URL {
  if (typeof value !== "string") throw new Error("Invalid event link.");
  const current = new URL(currentOrigin);
  const link = new URL(value,current.origin);
  if (!["https:","http:"].includes(link.protocol) || link.username || link.password || (!publicOrigins.has(link.origin) && link.origin !== current.origin) || link.pathname !== path || link.search || !/^#token=[A-Za-z0-9_-]{43}$/.test(link.hash)) throw new Error("Invalid event link.");
  // Preserve the credential exactly, but avoid alias redirects when sharing it.
  return publicOrigins.has(link.origin) ? new URL(`${path}${link.hash}`,DEFAULT_PUBLIC_SITE_URL) : link;
}
