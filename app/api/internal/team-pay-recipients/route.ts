import { prisma } from "@/lib/prisma";
import { teamPayRecipients } from "@/lib/studio-team-pay-recipients";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return teamPayRecipients(request, {
    fetchRoster: (workspaceId) => prisma.adminUser.findMany({
      where: { workspaceId, active: true, state: "ACTIVE", role: {in: ["OWNER","ADMIN"]} },
      select: { id: true, email: true, role: true },
      orderBy: { id: "asc" },
      take: 21,
    }),
  });
}
