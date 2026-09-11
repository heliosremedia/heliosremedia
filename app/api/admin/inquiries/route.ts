import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { InquiryStatus } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { inquiryAssigneeWhere } from "@/lib/inquiry-ownership";

const statuses = new Set(Object.values(InquiryStatus));
function refresh() { revalidatePath("/admin"); revalidatePath("/admin/inquiries"); }
function text(value: unknown, max: number, required = false) { const result = typeof value === "string" ? value.trim() : ""; if ((required && !result) || result.length > max) throw new Error("INVALID_TEXT"); return result || null; }

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const scope = await getContentOwnershipScope(session.workspaceId);
    const body = await request.json() as Record<string, unknown>;
    const inquiryId = text(body.inquiryId, 200, true)!;
    const action = text(body.action, 40, true)!;
    if (action !== "update-workflow" && action !== "add-note") return NextResponse.json({ success: false, error: "Unsupported inquiry action." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      // Scope and lock the parent before creating any child activity or note.
      const claimed = await tx.inquiry.updateMany({ where: { id: inquiryId, ...scope }, data: { lastActivityAt: new Date() } });
      if (claimed.count !== 1) throw new Error("INQUIRY_NOT_FOUND");
      if (action === "add-note") {
        const note = text(body.note, 3000, true)!;
        const created = await tx.inquiryNote.create({ data: { inquiryId, authorId: session.userId, body: note }, include: { author: { select: { displayName: true } } } });
        await tx.inquiryActivity.create({ data: { inquiryId, actorId: session.userId, action: "NOTE_ADDED", summary: "Internal note added." } });
        return { note: created, summary: "Internal inquiry note added." };
      }
      const status = typeof body.status === "string" && statuses.has(body.status as InquiryStatus) ? body.status as InquiryStatus : undefined;
      const assignedToId = body.assignedToId === null || body.assignedToId === "" ? null : text(body.assignedToId, 200);
      if (assignedToId) {
        const user = await tx.adminUser.findFirst({ where: { id: assignedToId, ...inquiryAssigneeWhere(session.workspaceId) }, select: { id: true } });
        if (!user) throw new Error("INVALID_ASSIGNEE");
      }
      const followText = text(body.followUpAt, 40);
      const followUpAt = followText ? new Date(followText) : null;
      if (followUpAt && Number.isNaN(followUpAt.getTime())) throw new Error("INVALID_DATE");
      const existing = await tx.inquiry.findFirstOrThrow({ where: { id: inquiryId, ...scope }, select: { status: true, assignedToId: true, followUpAt: true } });
      const summary = status && status !== existing.status ? `Status changed from ${existing.status} to ${status}.` : assignedToId !== existing.assignedToId ? "Inquiry assignment updated." : "Follow-up date updated.";
      const inquiry = await tx.inquiry.update({ where: { id: inquiryId, ...scope }, data: { ...(status ? { status } : {}), assignedToId, followUpAt } });
      await tx.inquiryActivity.create({ data: { inquiryId, actorId: session.userId, action: "WORKFLOW_UPDATED", summary, metadata: { previousStatus: existing.status, status: status ?? existing.status } } });
      return { inquiry, summary };
    });
    await recordAuditEvent({ workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email, action: action === "add-note" ? "INQUIRY_NOTE_ADDED" : "INQUIRY_UPDATED", entityType: "Inquiry", entityId: inquiryId, summary: result.summary });
    refresh();
    return NextResponse.json({ success: true, ...("note" in result ? { note: result.note } : { inquiry: result.inquiry }) });
  } catch (error) {
    if (error instanceof Error && error.message === "INQUIRY_NOT_FOUND") return NextResponse.json({ success: false, error: "Inquiry not found." }, { status: 404 });
    const messages: Record<string, string> = { INVALID_TEXT: "Complete the required fields and stay within their limits.", INVALID_ASSIGNEE: "Choose an active user from this company.", INVALID_DATE: "Choose a valid follow-up date." };
    if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 });
    console.error("Unable to update inquiry:", error);
    return NextResponse.json({ success: false, error: "The inquiry could not be updated." }, { status: 500 });
  }
}
