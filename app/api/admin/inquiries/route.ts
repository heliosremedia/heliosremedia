import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { InquiryStatus } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const statuses = new Set(Object.values(InquiryStatus));
function refresh() { revalidatePath("/admin"); revalidatePath("/admin/inquiries"); }
function text(value: unknown, max: number, required = false) { const result = typeof value === "string" ? value.trim() : ""; if ((required && !result) || result.length > max) throw new Error("INVALID_TEXT"); return result || null; }

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession(); if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>; const inquiryId = text(body.inquiryId, 200, true)!; const action = text(body.action, 40, true)!;
    if (action === "update-workflow") {
      const status = typeof body.status === "string" && statuses.has(body.status as InquiryStatus) ? body.status as InquiryStatus : undefined;
      const assignedToId = body.assignedToId === null || body.assignedToId === "" ? null : text(body.assignedToId, 200);
      if (assignedToId) { const user = await prisma.adminUser.findFirst({ where: { id: assignedToId, active: true }, select: { id: true } }); if (!user) throw new Error("INVALID_ASSIGNEE"); }
      const followText = text(body.followUpAt, 40); const followUpAt = followText ? new Date(followText) : null; if (followUpAt && Number.isNaN(followUpAt.getTime())) throw new Error("INVALID_DATE");
      const existing = await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { status: true, assignedToId: true, followUpAt: true } }); if (!existing) return NextResponse.json({ success: false, error: "Inquiry not found." }, { status: 404 });
      const summary = status && status !== existing.status ? `Status changed from ${existing.status} to ${status}.` : assignedToId !== existing.assignedToId ? "Inquiry assignment updated." : "Follow-up date updated.";
      const inquiry = await prisma.$transaction(async (tx) => { const updated = await tx.inquiry.update({ where: { id: inquiryId }, data: { ...(status ? { status } : {}), assignedToId, followUpAt, lastActivityAt: new Date() } }); await tx.inquiryActivity.create({ data: { inquiryId, actorId: session.userId, action: "WORKFLOW_UPDATED", summary, metadata: { previousStatus: existing.status, status: status ?? existing.status } } }); return updated; });
      await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "INQUIRY_UPDATED", entityType: "Inquiry", entityId: inquiryId, summary }); refresh(); return NextResponse.json({ success: true, inquiry });
    }
    if (action === "add-note") {
      const note = text(body.note, 3000, true)!;
      const result = await prisma.$transaction(async (tx) => { const created = await tx.inquiryNote.create({ data: { inquiryId, authorId: session.userId, body: note }, include: { author: { select: { displayName: true } } } }); await tx.inquiryActivity.create({ data: { inquiryId, actorId: session.userId, action: "NOTE_ADDED", summary: "Internal note added." } }); await tx.inquiry.update({ where: { id: inquiryId }, data: { lastActivityAt: new Date() } }); return created; });
      await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "INQUIRY_NOTE_ADDED", entityType: "Inquiry", entityId: inquiryId, summary: "Internal inquiry note added." }); refresh(); return NextResponse.json({ success: true, note: result });
    }
    return NextResponse.json({ success: false, error: "Unsupported inquiry action." }, { status: 400 });
  } catch (error) { const messages: Record<string,string> = { INVALID_TEXT: "Complete the required fields and stay within their limits.", INVALID_ASSIGNEE: "Choose an active admin user.", INVALID_DATE: "Choose a valid follow-up date." }; if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 }); console.error("Unable to update inquiry:", error); return NextResponse.json({ success: false, error: "The inquiry could not be updated." }, { status: 500 }); }
}
