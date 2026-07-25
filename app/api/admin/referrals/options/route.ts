import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReferralAdminSession } from "@/lib/referrals/access";

export async function GET() {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const [groups, clients] = await Promise.all([
    prisma.communicationGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { memberships: true } } },
    }),
    prisma.communicationClient.findMany({
      where: { archivedAt: null },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, email: true, emailSubscribed: true, emailStatus: true },
      take: 1_000,
    }),
  ]);
  return NextResponse.json({
    success: true,
    groups: groups.map(group => ({ id: group.id, name: group.name, count: group._count.memberships })),
    clients,
  });
}
