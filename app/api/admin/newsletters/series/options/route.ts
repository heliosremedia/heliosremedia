import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
} from "@/lib/newsletters/api";

export async function GET() {
  if (!await requireNewsletterAdministrator()) return forbiddenNewsletterResponse();
  const groups = await prisma.communicationGroup.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { memberships: true } } },
  });
  return NextResponse.json({
    success: true,
    groups: groups.map((group) => ({ id: group.id, name: group.name, count: group._count.memberships })),
  });
}
