import { portalTarget, portalRedirect, allowedPortalPost } from "@/lib/upload-portal-forwarding";
import { getAdminSession, SESSION_COOKIE } from "@/lib/auth/session";
import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function forward(request: Request, context: { params: Promise<{ asset?: string[] }> }) {
  const session = await getAdminSession();
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/admin/production-console");
    return Response.redirect(login, 307);
  }
  if (!["OWNER", "ADMIN"].includes(session.role)) return new Response("Administrator access required.", { status: 403 });
  const { asset } = await context.params;
  const assetPath = asset?.join("/") || "index.html";
  if (request.method === "POST" && !allowedPortalPost(assetPath, request.headers.get("origin"))) return new Response("Forbidden", {status:403});
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    const target = portalTarget(assetPath, request.url);
    const upstream = await fetch(target, {
      method: request.method,
      headers: { cookie: `${SESSION_COOKIE}=${token}`, ...(request.method === "POST" ? {origin: request.headers.get("origin")!} : {}) },
      redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = portalRedirect(assetPath, upstream.headers.get("Location") || "");
      return new Response(null, {status:303, headers:{Location:location,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
    }
    return new Response(upstream.body, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
      ...(upstream.headers.get("Content-Security-Policy") ? {"Content-Security-Policy": upstream.headers.get("Content-Security-Policy")!} : {}),
    }});
  } catch {
    return new Response("Upload portal temporarily unavailable.", { status: 503, headers: {"Cache-Control":"private, no-store"} });
  }
}

export const GET = forward;
export const POST = forward;
