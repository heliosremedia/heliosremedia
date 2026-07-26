import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { Prisma } from "@/app/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function normalizeName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 80) throw new Error("INVALID_NAME");
  return { name, normalizedName: name.toLocaleLowerCase("en-US") };
}

async function managerSession() {
  const session = await getAdminSession();
  return session && (session.role === "OWNER" || session.role === "ADMIN")
    ? session
    : null;
}

function errorResponse(error: unknown) {
  if (error instanceof Error && error.message === "INVALID_NAME") {
    return NextResponse.json(
      { success: false, error: "Enter a group name between 1 and 80 characters." },
      { status: 400 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { success: false, error: "A group with that name already exists." },
      { status: 409 },
    );
  }
  console.error("Unable to manage communication group:", error);
  return NextResponse.json(
    { success: false, error: "The group could not be updated." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  const session = await managerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Owner or administrator access is required." },
      { status: 403 },
    );
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const group = await prisma.communicationGroup.create({
      data: normalizeName(body.name),
      select: { id: true, name: true },
    });
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "COMMUNICATION_GROUP_CREATED",
      entityType: "CommunicationGroup",
      entityId: group.id,
      summary: `Client group "${group.name}" created.`,
    });
    revalidatePath("/admin/clients");
    return NextResponse.json({ success: true, group }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const session = await managerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Owner or administrator access is required." },
      { status: 403 },
    );
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    if (!groupId) {
      return NextResponse.json({ success: false, error: "Group not found." }, { status: 404 });
    }
    const group = await prisma.communicationGroup.update({
      where: { id: groupId, systemManaged: false },
      data: normalizeName(body.name),
      select: { id: true, name: true },
    });
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "COMMUNICATION_GROUP_RENAMED",
      entityType: "CommunicationGroup",
      entityId: group.id,
      summary: `Client group renamed to "${group.name}".`,
    });
    revalidatePath("/admin/clients");
    return NextResponse.json({ success: true, group });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const session = await managerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Owner or administrator access is required." },
      { status: 403 },
    );
  }
  const body = (await request.json()) as Record<string, unknown>;
  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  const group = await prisma.communicationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, systemManaged: true, _count: { select: { memberships: true } } },
  });
  if (!group) {
    return NextResponse.json({ success: false, error: "Group not found." }, { status: 404 });
  }
  if (group.systemManaged) {
    return NextResponse.json({ success: false, error: "System-managed groups cannot be deleted or repurposed." }, { status: 409 });
  }
  await prisma.communicationGroup.delete({ where: { id: group.id } });
  await recordAuditEvent({
    actorId: session.userId,
    actorEmail: session.email,
    action: "COMMUNICATION_GROUP_DELETED",
    entityType: "CommunicationGroup",
    entityId: group.id,
    summary: `Client group "${group.name}" deleted. Client records were preserved.`,
    metadata: { removedMemberships: group._count.memberships },
  });
  revalidatePath("/admin/clients");
  return NextResponse.json({ success: true });
}
