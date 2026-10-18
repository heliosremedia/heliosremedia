import { getAdminSession, SESSION_COOKIE } from "@/lib/auth/session";
import { cookies } from "next/headers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ asset?: string[] }> }) {
  const session = await getAdminSession();
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/admin/production-console");
    return Response.redirect(login, 307);
  }
  if (!["OWNER", "ADMIN"].includes(session.role)) return new Response("Administrator access required.", { status: 403 });
  const { asset } = await context.params;
  const target = new URL("https://helios-upload-portal.vercel.app/api/portal");
  target.searchParams.set("asset", asset?.join("/") || "index.html");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    const upstream = await fetch(target, {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    return new Response(upstream.body, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    }});
  } catch {
    return new Response("Upload portal temporarily unavailable.", { status: 503, headers: {"Cache-Control":"private, no-store"} });
  }
}
