import { getAdminSession } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getAdminSession();
  const authorized = session?.role === "ADMIN";
  return Response.json({ authorized }, {
    status: !session ? 401 : authorized ? 200 : 403,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
