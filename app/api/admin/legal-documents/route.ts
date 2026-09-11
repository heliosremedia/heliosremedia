import { getAdminSession } from "@/lib/auth/session";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sanitizeLegalHtml } from "@/lib/legal-html";

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
    }
    const tenantMode = tenantContextEnabled();
    if (!tenantMode) {
      const workspaces = await prisma.workspace.findMany({ take: 2, select: { id: true } });
      if (workspaces.length !== 1 || workspaces[0].id !== session.workspaceId) {
        return NextResponse.json({ success: false, error: "Legal settings require configured company ownership." }, { status: 409 });
      }
    }
    const scope = await getContentOwnershipScope(session.workspaceId);
    const body = (await request.json()) as Record<string, unknown>;
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

    const documentMutation = prisma.legalDocument.upsert({
      where: { type, AND: [scope] },
      create: { workspaceId: session.workspaceId, type, title, content, published },
      update: { title, content, published },
    });
    const flags = type === "PRIVACY_POLICY" ? { privacyPolicyPublished: published } : { termsOfServicePublished: published };
    const settingsMutation = prisma.siteSettings.upsert({
      where: tenantMode ? { workspaceId: session.workspaceId } : { id: "default", AND: [scope] },
      create: { ...(tenantMode ? {} : { id: "default" }), workspaceId: session.workspaceId, ...flags },
      update: flags,
    });
    const [document] = await prisma.$transaction([documentMutation, settingsMutation]);

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    revalidatePath(type === "PRIVACY_POLICY" ? "/privacy" : "/terms");
    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error("Unable to update legal document:", error);
    return NextResponse.json({ success: false, error: "The legal document could not be saved." }, { status: 500 });
  }
}
