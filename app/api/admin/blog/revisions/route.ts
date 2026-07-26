import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const postId = new URL(request.url).searchParams.get("postId")?.trim();
  if (!postId) return NextResponse.json({ success: false, error: "Article ID required." }, { status: 400 });
  const revisions = await prisma.blogPostRevision.findMany({
    where: { postId }, orderBy: { createdAt: "desc" }, take: 20,
  });
  return NextResponse.json({ success: true, revisions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { postId?: string; revisionId?: string };
    if (!body.postId || !body.revisionId) throw new Error("INVALID");
    const revision = await prisma.blogPostRevision.findFirstOrThrow({ where: { id: body.revisionId, postId: body.postId } });
    const post = await prisma.$transaction(async transaction => {
      const current = await transaction.blogPost.findUniqueOrThrow({ where: { id: body.postId } });
      await transaction.blogPostRevision.create({
        data: {
          postId: current.id, title: current.title, excerpt: current.excerpt, content: current.content,
          seoTitle: current.seoTitle, seoDescription: current.seoDescription, sourceLinks: current.sourceLinks ?? [],
          changeSummary: "Before revision restore", aiGenerated: false,
        },
      });
      return transaction.blogPost.update({
        where: { id: current.id },
        data: {
          title: revision.title, excerpt: revision.excerpt, content: revision.content,
          seoTitle: revision.seoTitle, seoDescription: revision.seoDescription,
          sourceLinks: revision.sourceLinks ?? [], manualContent: true,
        },
      });
    });
    return NextResponse.json({ success: true, post });
  } catch {
    return NextResponse.json({ success: false, error: "That revision could not be restored." }, { status: 400 });
  }
}
