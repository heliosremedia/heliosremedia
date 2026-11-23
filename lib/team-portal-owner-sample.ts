import { gunzipSync } from "node:zlib";
import { sampleAssets } from "./team-portal-owner-sample-assets.ts";

const sampleRoot = "/admin/team-portal-sample";
const htmlType = "text/html; charset=utf-8";
const sampleRoutes = {
  "": ["index", htmlType],
  "my-pay.html": ["pay", htmlType],
  "helios-nav.css": ["nav", "text/css; charset=utf-8"],
} as const;

type SampleRoute = keyof typeof sampleRoutes;
type ReadStudioSession = () => Promise<{ role: string; email: string; workspaceId: string } | null>;
const sampleHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
};

function response(body: string | null, status: number, headers: HeadersInit = {}) {
  const result = new Headers(sampleHeaders);
  new Headers(headers).forEach((value, key) => result.set(key, value));
  return new Response(body, { status, headers: result });
}

// Match Studio's existing bootstrap-owner env normalization. No new secrets,
// local config, or roles are required. Missing configuration fails closed.
function configuredOwnerEmail(value: string | undefined) {
  const unquote = (v: string) =>
    (v.startsWith('"') || v.startsWith("'")) && (v.endsWith('"') || v.endsWith("'"))
      ? v.slice(1, -1).trim()
      : v;
  let normalized = unquote(value?.trim() ?? "");
  if (normalized.startsWith("HELIOS_ADMIN_EMAIL=")) {
    normalized = normalized.slice("HELIOS_ADMIN_EMAIL=".length).trim();
  }
  return unquote(normalized).toLowerCase();
}

export async function serveStudioTeamPortalSample(
  request: Request, parts: readonly string[], readSession: ReadStudioSession,
  ownerEmailSetting: string | undefined,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response(null, 405, { Allow: "GET, HEAD" });
  }
  const path = parts.length <= 1 ? parts[0] ?? "" : null;
  if (path === null || !Object.hasOwn(sampleRoutes, path)) return response(null, 404);
  const [key, type] = sampleRoutes[path as SampleRoute];
  let session;
  try {
    // Studio's existing server verifier checks the persisted role, active flag
    // and session version. Cookies, user IDs and roles are not forwarded.
    session = await readSession();
  } catch {
    return response(null, 503);
  }
  if (!session) {
    if (type !== htmlType) return response(null, 401);
    const next = path === "" ? sampleRoot : sampleRoot + "/" + path;
    return response(null, 303, { Location: "/login?next=" + encodeURIComponent(next) });
  }
  const ownerEmail = configuredOwnerEmail(ownerEmailSetting);
  if (session.role !== "OWNER" || !session.workspaceId || !ownerEmail || session.email.toLowerCase().trim() !== ownerEmail) {
    return response(null, 403);
  }
  if (request.method === "HEAD") return response(null, 200, { "Content-Type": type });
  let body = gunzipSync(Buffer.from(sampleAssets[key], "base64")).toString("utf8");
  if (type === htmlType) {
    // Explicit root paths also work when Next normalizes a trailing slash.
    // The logo and fonts are Studio's existing public brand assets.
    body = body
      .replaceAll("./my-pay.html", sampleRoot + "/my-pay.html")
      .replaceAll("./helios-nav.css", sampleRoot + "/helios-nav.css")
      .replaceAll("./#", sampleRoot + "#")
      .replaceAll("./helios-logo.png", "/brand/helios-logo.png")
      .replaceAll("./helios.otf", "/fonts/helios.otf")
      .replaceAll("./heliosbold.ttf", "/fonts/heliosbold.ttf")
      .replaceAll("helios-team-pay-sample-v1", "helios-studio-team-pay-sample-v1")
      .replace('href="https://heliosremedia.com/" target="_blank" rel="noopener noreferrer">Helios Studio</a> · Uses Studio permissions.', 'href="/admin">Back to Studio</a>');
  }
  return response(body, 200, { "Content-Type": type });
}
