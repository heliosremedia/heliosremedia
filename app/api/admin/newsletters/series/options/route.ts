import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
} from "@/lib/newsletters/api";

export async function GET() {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  const groups = await prisma.communicationGroup.findMany({
    where: await getContentOwnershipScope(session.workspaceId),
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { memberships: { where: { client: { workspaceMemberships: { some: { workspaceId: session.workspaceId } } } } } } } },
  });
  return NextResponse.json({
    success: true,
    groups: groups.map((group) => ({ id: group.id, name: group.name, count: group._count.memberships })),
  });
}
