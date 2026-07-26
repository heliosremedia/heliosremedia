import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { BlogPostStatus } from "@/app/generated/prisma/client";
import { slugifyBlogTitle } from "@/lib/blog";
import { prisma } from "@/lib/prisma";

const statuses = new Set(Object.values(BlogPostStatus));
const optional = (value: unknown, max: number) => {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > max) throw new Error("INVALID_TEXT");
  return result || null;
};
const required = (value: unknown, max: number) => {
  const result = optional(value, max);
  if (!result) throw new Error("INVALID_TEXT");
  return result;
};
function safeUrl(value: unknown) {
  const result = optional(value, 1000);
  if (!result) return null;
  const url = new URL(result);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("INVALID_URL");
  return url.toString();
}
function date(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_DATE");
  return parsed;
}
function sourceLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map(item => safeUrl(item)).filter((item): item is string => Boolean(item));
}
function refresh(slug?: string | null) {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");
}
function data(body: Record<string, unknown>) {
  const title = required(body.title, 180);
  const slug = slugifyBlogTitle(required(body.slug || title, 120));
  if (!slug) throw new Error("INVALID_SLUG");
  const status = typeof body.status === "string" && statuses.has(body.status as BlogPostStatus)
    ? body.status as BlogPostStatus : BlogPostStatus.DRAFT;
  const scheduledAt = status === BlogPostStatus.SCHEDULED ? date(body.scheduledAt) : null;
  if (status === BlogPostStatus.SCHEDULED && !scheduledAt) throw new Error("INVALID_DATE");
  return {
    title, slug, excerpt: optional(body.excerpt, 500), content: required(body.content, 100_000),
    author: optional(body.author, 120), category: optional(body.category, 100), status, scheduledAt,
    publishedAt: status === BlogPostStatus.PUBLISHED ? date(body.publishedAt) || new Date() : null,
    archivedAt: status === BlogPostStatus.ARCHIVED ? new Date() : null,
    featuredMediaId: optional(body.featuredMediaId, 200),
    featuredImageStorageKey: optional(body.featuredImageStorageKey, 1000),
    featuredImageUrl: safeUrl(body.featuredImageUrl),
    featuredImageAlt: optional(body.featuredImageAlt, 300),
    seoTitle: optional(body.seoTitle, 180), seoDescription: optional(body.seoDescription, 500),
    canonicalUrl: safeUrl(body.canonicalUrl), socialCaption: optional(body.socialCaption, 3000),
    sourceLinks: sourceLinks(body.sourceLinks),
  };
}
function error(error: unknown) {
  const messages: Record<string, string> = {
    INVALID_TEXT: "Complete the required fields and stay within their limits.",
    INVALID_URL: "Use a valid http or https URL.",
    INVALID_DATE: "Choose a valid schedule date and time.",
    INVALID_SLUG: "Enter a valid article URL slug.",
  };
  const message = error instanceof Error ? messages[error.message] : null;
  return message ? NextResponse.json({ success: false, error: message }, { status: 400 }) : null;
}

export async function POST(request: Request) {
  try {
    const post = await prisma.blogPost.create({ data: data(await request.json()) });
    refresh(post.slug);
    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (cause) {
    const response = error(cause); if (response) return response;
    console.error("Unable to create blog post:", cause);
    return NextResponse.json({ success: false, error: "The article could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const postId = required(body.postId, 200);
    const previous = await prisma.blogPost.findUniqueOrThrow({ where: { id: postId }, select: { slug: true } });
    const next = data(body);
    const post = await prisma.$transaction(async transaction => {
      const current = await transaction.blogPost.findUniqueOrThrow({ where: { id: postId } });
      await transaction.blogPostRevision.create({
        data: {
          postId, title: current.title, excerpt: current.excerpt, content: current.content,
          seoTitle: current.seoTitle, seoDescription: current.seoDescription,
          sourceLinks: current.sourceLinks ?? [], changeSummary: "Manual save", aiGenerated: false,
        },
      });
      return transaction.blogPost.update({
        where: { id: postId },
        data: { ...next, manualContent: next.content !== current.content || current.manualContent },
      });
    });
    refresh(previous.slug); refresh(post.slug);
    return NextResponse.json({ success: true, post });
  } catch (cause) {
    const response = error(cause); if (response) return response;
    console.error("Unable to update blog post:", cause);
    return NextResponse.json({ success: false, error: "The article could not be saved." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const postId = new URL(request.url).searchParams.get("postId")?.trim();
    if (!postId) return NextResponse.json({ success: false, error: "An article ID is required." }, { status: 400 });
    const post = await prisma.blogPost.delete({ where: { id: postId } });
    refresh(post.slug);
    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("Unable to delete blog post:", cause);
    return NextResponse.json({ success: false, error: "The article could not be deleted." }, { status: 500 });
  }
}
