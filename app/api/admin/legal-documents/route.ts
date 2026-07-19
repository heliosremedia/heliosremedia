import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sanitizeLegalHtml } from "@/lib/legal-html";

export async function PATCH(request: Request) {
  try {
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
      where: { type },
      create: { type, title, content, published },
      update: { title, content, published },
    });
    const settingsMutation = type === "PRIVACY_POLICY"
      ? prisma.siteSettings.upsert({ where: { id: "default" }, create: { id: "default", privacyPolicyPublished: published }, update: { privacyPolicyPublished: published } })
      : prisma.siteSettings.upsert({ where: { id: "default" }, create: { id: "default", termsOfServicePublished: published }, update: { termsOfServicePublished: published } });
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
