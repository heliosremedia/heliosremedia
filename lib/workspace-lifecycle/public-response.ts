import { NextResponse } from "next/server";
import { normalizeWorkspaceHostname } from "@/lib/workspace-context-core";
import { lifecycleEnabled } from "./state";

// Host-owned content only. Token-owned referrals, provider callbacks and signed
// unsubscribe require their own owned policy and are not classified by Host.
const publicRoots = ["about", "blog", "book", "client-portal", "contact", "faq", "films", "google-business-integration", "inquire", "locations", "photo-finishes", "portfolio", "privacy", "reviews", "services", "terms"];
const publicApis = ["/api/portfolio", "/api/inquiries", "/api/client-portal"];
export function isPublicLifecyclePath(pathname: string) {
  return pathname === "/" || pathname === "/sitemap.xml" ||
    publicRoots.some(root => pathname === `/${root}` || pathname.startsWith(`/${root}/`)) ||
    publicApis.some(root => pathname === root || pathname.startsWith(`${root}/`));
}
export async function publicLifecycleResponse(request: { headers: Headers }) {
  if (!lifecycleEnabled()) return NextResponse.next();
  const unavailable = () => new NextResponse("This site is temporarily unavailable.", {
    status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" },
  });
  try {
    const hostname = normalizeWorkspaceHostname(request.headers.get("host"));
    if (!hostname) return unavailable();
    // One uncached domain/workspace lookup before rendering. The application
    // resolver retains its own gate; no trusted identity header is injected.
    const { prisma } = await import("@/lib/prisma");
    const domain = await prisma.workspaceDomain.findUnique({ where: { hostname },
      select: { purpose: true, status: true, workspace: { select: { lifecycleState: true } } } });
    if (domain?.purpose === "PUBLIC_SITE" && domain.status === "ACTIVE" && domain.workspace.lifecycleState !== "ACTIVE") return unavailable();
    return NextResponse.next();
  } catch { return unavailable(); }
}
