import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { blogImageUrl } from "@/lib/blog";
import { getSiteUrl } from "@/lib/site";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ postId: string }> }) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }
  const { postId } = await context.params;
  const post = await prisma.blogPost.findFirst({
    where: { id: postId, status: "PUBLISHED" },
    include: { featuredMedia: { select: { storageKey: true } } },
  });
  if (!post) return NextResponse.json({ success: false, error: "Publish this article before sharing it with clients." }, { status: 409 });
  const articleUrl = `${getSiteUrl()}/blog/${post.slug}`;
  const imageUrl = blogImageUrl(post);
  const body = [
    imageUrl ? `Featured image: ${imageUrl}` : "",
    post.excerpt || "",
    `Read the full article: ${articleUrl}`,
  ].filter(Boolean).join("\n\n");
  const campaign = await prisma.emailCampaign.create({
    data: {
      subject: post.title,
      previewText: post.excerpt?.slice(0, 180) || null,
      body,
      status: "DRAFT",
      recipientMode: "ALL",
      selection: { source: "BLOG", postId, articleUrl },
      createdById: session.userId,
    },
  });
  await recordAuditEvent({
    actorId: session.userId, actorEmail: session.email,
    action: "BLOG_EMAIL_DRAFT_CREATED", entityType: "EmailCampaign", entityId: campaign.id,
    summary: `Created an Email Studio draft from "${post.title}".`,
    metadata: { postId },
  });
  return NextResponse.json({ success: true, campaignId: campaign.id, href: `/admin/email-studio?campaign=${campaign.id}` });
}
