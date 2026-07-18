import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  displayOrder: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { faqs: true } },
} as const;

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(value: string, excludedId?: string) {
  const base = slugify(value) || "faq-category";
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.faqCategory.findFirst({
      where: { slug: candidate, ...(excludedId ? { id: { not: excludedId } } : {}) },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix++}`;
  }

  return candidate;
}

function refreshFaqs() {
  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
  revalidatePath("/sitemap.xml");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    if (!name || name.length > 100) {
      return NextResponse.json({ success: false, error: "A category name between 1 and 100 characters is required." }, { status: 400 });
    }

    if ((description?.length ?? 0) > 300) {
      return NextResponse.json({ success: false, error: "The category description must be 300 characters or fewer." }, { status: 400 });
    }

    const order = await prisma.faqCategory.aggregate({ _max: { displayOrder: true } });
    const category = await prisma.faqCategory.create({
      data: {
        name,
        slug: await uniqueSlug(typeof body.slug === "string" ? body.slug : name),
        description,
        displayOrder: (order._max.displayOrder ?? -1) + 1,
      },
      select: categorySelect,
    });

    refreshFaqs();
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error) {
    console.error("Unable to create FAQ category:", error);
    return NextResponse.json({ success: false, error: "The FAQ category could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "reorder") {
      const ids = Array.isArray(body.categoryIds)
        ? body.categoryIds.filter((id): id is string => typeof id === "string")
        : [];
      const current = await prisma.faqCategory.findMany({ select: { id: true } });

      if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) {
        return NextResponse.json({ success: false, error: "The category list changed before the order was saved. Refresh and try again." }, { status: 409 });
      }

      await prisma.$transaction(ids.map((id, index) => prisma.faqCategory.update({ where: { id }, data: { displayOrder: index } })));
      refreshFaqs();
      return NextResponse.json({ success: true, categoryIds: ids });
    }

    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    if (!categoryId) {
      return NextResponse.json({ success: false, error: "A category ID is required." }, { status: 400 });
    }

    if (action === "set-active") {
      if (typeof body.active !== "boolean") {
        return NextResponse.json({ success: false, error: "A valid category status is required." }, { status: 400 });
      }
      const category = await prisma.faqCategory.update({ where: { id: categoryId }, data: { active: body.active }, select: categorySelect });
      refreshFaqs();
      return NextResponse.json({ success: true, category });
    }

    if (action === "update") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;

      if (!name || name.length > 100 || (description?.length ?? 0) > 300) {
        return NextResponse.json({ success: false, error: "Enter a valid category name and description." }, { status: 400 });
      }

      const category = await prisma.faqCategory.update({
        where: { id: categoryId },
        data: {
          name,
          slug: await uniqueSlug(typeof body.slug === "string" ? body.slug : name, categoryId),
          description,
        },
        select: categorySelect,
      });
      refreshFaqs();
      return NextResponse.json({ success: true, category });
    }

    return NextResponse.json({ success: false, error: "Unsupported category action." }, { status: 400 });
  } catch (error) {
    console.error("Unable to update FAQ category:", error);
    return NextResponse.json({ success: false, error: "The FAQ category could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const categoryId = new URL(request.url).searchParams.get("categoryId")?.trim();
    if (!categoryId) {
      return NextResponse.json({ success: false, error: "A category ID is required." }, { status: 400 });
    }

    const category = await prisma.faqCategory.findUnique({ where: { id: categoryId }, select: { _count: { select: { faqs: true } } } });
    if (!category) {
      return NextResponse.json({ success: false, error: "The category was not found." }, { status: 404 });
    }
    if (category._count.faqs > 0) {
      return NextResponse.json({ success: false, error: "Move or delete every FAQ in this category before deleting it." }, { status: 409 });
    }

    await prisma.faqCategory.delete({ where: { id: categoryId } });
    refreshFaqs();
    return NextResponse.json({ success: true, deletedCategoryId: categoryId });
  } catch (error) {
    console.error("Unable to delete FAQ category:", error);
    return NextResponse.json({ success: false, error: "The FAQ category could not be deleted." }, { status: 500 });
  }
}
