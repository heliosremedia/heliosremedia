import { publicHealthResponse } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = publicHealthResponse({ publicSite: true, bookingRoute: true, bookingDestination: null });
  return Response.json(body, {
    status: body.status === "operational" ? 200 : 503,
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
  });
}
