import { getSiteSettingsWriteTarget } from "@/lib/site-settings-ownership";
import { getAdminSession } from "@/lib/auth/session";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sanitizeLegalHtml } from "@/lib/legal-html";
import { requireLockedWorkspaceAdministrator } from "@/lib/workspace-write-access";
import type { Prisma } from "@/app/generated/prisma/client";

const documentFields = { id: true, type: true, title: true, content: true, published: true, updatedAt: true } as const;
const nextRevision = (date: Date) => new Date(Math.max(Date.now(), date.getTime() + 1));

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
    }
    const value: unknown = await request.json().catch(() => null);
    if (!value || typeof value !== "object" || Array.isArray(value)) return NextResponse.json({ success: false, error: "Enter a valid legal document." }, { status: 400 });
    const body = value as Record<string, unknown>;
    const revisionProtocol = request.headers.get("x-helios-legal-revision");
    if (revisionProtocol !== null && (revisionProtocol !== "1" || body.updatedAt === undefined)) return NextResponse.json({ success: false, error: "Reload the legal editor before saving." }, { status: 400 });
    const type = body.type === "PRIVACY_POLICY" || body.type === "TERMS_OF_SERVICE" ? body.type : null;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const rawContent = typeof body.content === "string" ? body.content.trim() : "";
    const content = sanitizeLegalHtml(rawContent);
    const published = body.published === true;

    if (!type || !title || title.length > 160 || rawContent.length > 100_000) {
      return NextResponse.json({ success: false, error: "Enter a title and keep the legal document under 100,000 characters." }, { status: 400 });
    }
    if (published && content.length < 100) {
      return NextResponse.json({ success: false, error: "Add the complete legal document before publishing it." }, { status: 400 });
    }
    let browserRevision: Date | undefined;
    if (body.updatedAt !== undefined) {
      if (typeof body.updatedAt !== "string" || !Number.isFinite(Date.parse(body.updatedAt)) || new Date(body.updatedAt).toISOString() !== body.updatedAt) return NextResponse.json({ success: false, error: "The document revision is invalid." }, { status: 400 });
      browserRevision = new Date(body.updatedAt);
    }
    const target = await getSiteSettingsWriteTarget(session.workspaceId);
    const scope = await getContentOwnershipScope(session.workspaceId);
    const existing = await prisma.legalDocument.findFirst({ where: { type, AND: [scope] }, select: { id: true, workspaceId: true, updatedAt: true } });
    if (browserRevision && browserRevision.getTime() !== (existing?.updatedAt.getTime() ?? 0)) throw new Error("LEGAL_CHANGED");
    const previousSettings = await prisma.siteSettings.findUnique({ where: target.where, select: { id: true, workspaceId: true, updatedAt: true } });
    const flags = type === "PRIVACY_POLICY" ? { privacyPolicyPublished: published } : { termsOfServicePublished: published };
    const document = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceAdministrator(tx, session);
      const currentTarget = await getSiteSettingsWriteTarget(session.workspaceId, tx);
      const currentScope = await getContentOwnershipScope(session.workspaceId, tx);
      if (JSON.stringify(target) !== JSON.stringify(currentTarget) || JSON.stringify(scope) !== JSON.stringify(currentScope)) throw new Error("LEGAL_CHANGED");
      // The isolated contract rehearsal installs a write guard requiring this
      // transaction-local marker. It is not a substitute for membership checks.
      await tx.$queryRaw`SELECT set_config('helios.legal_workspace', ${session.workspaceId}, true)`;
      let saved;
      if (existing) {
        const where: Prisma.LegalDocumentWhereInput = { id: existing.id, type, workspaceId: existing.workspaceId, updatedAt: existing.updatedAt, AND: [currentScope] };
        const changed = await tx.legalDocument.updateMany({ where, data: { title, content, published, updatedAt: nextRevision(existing.updatedAt) } });
        if (changed.count !== 1) throw new Error("LEGAL_CHANGED");
        saved = await tx.legalDocument.findFirst({ where: { id: existing.id, type, AND: [currentScope] }, select: documentFields });
        if (!saved) throw new Error("LEGAL_CHANGED");
      } else {
        saved = await tx.legalDocument.create({ data: { workspaceId: session.workspaceId, type, title, content, published }, select: documentFields });
      }
      if (previousSettings) {
        const changed = await tx.siteSettings.updateMany({ where: { AND: [currentTarget.where, { id: previousSettings.id, workspaceId: previousSettings.workspaceId, updatedAt: previousSettings.updatedAt }] }, data: { ...flags, updatedAt: nextRevision(previousSettings.updatedAt) } });
        if (changed.count !== 1) throw new Error("LEGAL_CHANGED");
      } else {
        const publishedDocuments = await tx.legalDocument.findMany({ where: { published: true, AND: [currentScope] }, select: { type: true } });
        await tx.siteSettings.create({ data: {
          ...currentTarget.createIdentity,
          privacyPolicyPublished: publishedDocuments.some(row => row.type === "PRIVACY_POLICY"),
          termsOfServicePublished: publishedDocuments.some(row => row.type === "TERMS_OF_SERVICE"),
        }, select: { id: true } });
      }
      return saved;
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    revalidatePath(type === "PRIVACY_POLICY" ? "/privacy" : "/terms");
    return NextResponse.json({ success: true, revisionProtocol: 1, document });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
    if ((error instanceof Error && error.message === "LEGAL_CHANGED") || (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) return NextResponse.json({ success: false, error: "The document or settings changed, or this document type is unavailable. Keep your draft and reload before saving again." }, { status: 409 });
    console.error("Unable to update legal document", { category: "request_failed" });
    return NextResponse.json({ success: false, error: "The legal document could not be saved." }, { status: 500 });
  }
}
