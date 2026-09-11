import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReferralAdminSession } from "@/lib/referrals/access";

export async function GET() {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const [groups, clients] = await Promise.all([
    prisma.communicationGroup.findMany({
      where: await getContentOwnershipScope(session.workspaceId),
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { memberships: { where: { client: { workspaceMemberships: { some: { workspaceId: session.workspaceId } } } } } } } },
    }),
    prisma.communicationClient.findMany({
      where: { archivedAt: null, workspaceMemberships: { some: { workspaceId: session.workspaceId } } },
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
