import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || (session.role !== "OWNER" && session.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Owner or administrator access is required." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  const clientIds = Array.isArray(body.clientIds)
    ? [...new Set(body.clientIds.filter((value): value is string => typeof value === "string"))]
    : [];
  const operation = body.operation === "remove" ? "remove" : body.operation === "add" ? "add" : null;
  if (!groupId || !clientIds.length || !operation || clientIds.length > 500) {
    return NextResponse.json(
      { success: false, error: "Choose a group and at least one valid client." },
      { status: 400 },
    );
  }

  const [group, validClients] = await Promise.all([
    prisma.communicationGroup.findUnique({ where: { id: groupId }, select: { id: true, name: true } }),
    prisma.communicationClient.findMany({
      where: { id: { in: clientIds } },
      select: { id: true },
    }),
  ]);
  if (!group) {
    return NextResponse.json({ success: false, error: "Group not found." }, { status: 404 });
  }
  const validIds = validClients.map((client) => client.id);
  if (!validIds.length) {
    return NextResponse.json({ success: false, error: "No matching clients were found." }, { status: 404 });
  }

  const result =
    operation === "add"
      ? await prisma.communicationGroupMembership.createMany({
          data: validIds.map((clientId) => ({ groupId, clientId })),
          skipDuplicates: true,
        })
      : await prisma.communicationGroupMembership.deleteMany({
          where: { groupId, clientId: { in: validIds } },
        });

  await recordAuditEvent({
    actorId: session.userId,
    actorEmail: session.email,
    action: operation === "add" ? "CLIENTS_ADDED_TO_GROUP" : "CLIENTS_REMOVED_FROM_GROUP",
    entityType: "CommunicationGroup",
    entityId: group.id,
    summary: `${result.count} client${result.count === 1 ? "" : "s"} ${operation === "add" ? "added to" : "removed from"} "${group.name}".`,
    metadata: { requestedClientCount: clientIds.length, changedClientCount: result.count },
  });
  revalidatePath("/admin/clients");
  return NextResponse.json({ success: true, changed: result.count });
}
